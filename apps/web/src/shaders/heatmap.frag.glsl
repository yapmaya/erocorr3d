// apps/web/src/shaders/heatmap.frag.glsl
//
// Isı haritası fragment shader'ı. `vDamage` (bkz. heatmap.vert.glsl) [uMinValue,
// uMaxValue] aralığında normalize edilip 1B `uColormapTexture`'dan renk
// örneklenir. Ardından: eşik-bazlı vurgular (uyarı/kritik nabız), sabit mm
// aralıklı iso-kontur çizgileri (fwidth ile kenar yumuşatma), "duvar delindi"
// tehlike deseni (damage >= wallThickness) ve son olarak metalik görünümü
// koruyan basit Lambert+Fresnel aydınlatma karışımı uygulanır.
//
// NaN/Infinity güvenliği: bozuk bir skaler değer gelirse (ör. bölme-sıfır
// sonucu bir hesap hatası) bu piksel SİYAH gösterilir — sessizce yanlış bir
// renk üretip kullanıcıyı yanıltmak yerine görünür bir hata sinyali. Bu,
// `damageHeatmapMaterial.ts::sanitizeScalarValues`in CPU tarafındaki aynı
// korumanın GPU tarafındaki YEDEĞİdir (CPU tarafı zaten temizlemiş olsa da,
// GPU'ya doğrudan attribute yazan gelecekteki bir çağıran için savunma amaçlı).
//
// NOT (bu oturumda tarayıcıda gerçek render denenip DÜZELTİLEN gerçek bir hata):
// `#extension GL_OES_standard_derivatives : enable` satırı BURADA DAHA ÖNCE
// vardı ve WebGL2/GLSL300 ES altında (bu projenin three.js/R3F varsayılan
// bağlamı) sert bir derleme hatasına yol açıyordu — three.js, ShaderMaterial
// için `#version 300 es` + kendi define'larını BU dosyanın İÇERİĞİNİN
// ÖNÜNE ekliyor, bu da `#extension`ın "ilk preprocessor-olmayan token'dan
// ÖNCE olmalı" kuralını ihlal ediyordu (ESSL3: 'extension directive must
// occur before any non-preprocessor tokens'). fwidth/dFdx/dFdy GLSL ES
// 3.00'te ZATEN ÇEKİRDEK (extension'a gerek yok) — satır KALDIRILDI,
// WebGL1 için özel bir fallback GEREKMİYOR (bu projenin R3F/three.js sürümü
// modern tarayıcılarda her zaman WebGL2 bağlamı açar).
precision highp float;

varying float vDamage;
varying vec3 vNormalW;
varying vec3 vWorldPosition;

uniform float uMinValue;
uniform float uMaxValue;
uniform sampler2D uColormapTexture;
uniform float uOpacity;
uniform float uThresholdWarn;
uniform float uThresholdCritical;
uniform float uWallThicknessMm;
uniform float uIsoStepMm;
uniform float uTime;
uniform vec3 uLightDirection;
// KALAN DUVAR KALINLIĞI / KALAN ÖMÜR gibi "düşük değer = yüksek tehlike"
// anlamına gelen modlarda TRUE: renk skalası ters örneklenir (t yerine
// 1-t) — böylece kırmızı HER ZAMAN "tehlikeli" anlamına gelir, mm/yıl gibi
// "yüksek değer = tehlike" metriklerinde olduğu gibi. Eşikler/iso-çizgiler
// gerçek (ters çevrilmemiş) `safeValue` üzerinde çalışmaya devam eder —
// yalnızca colormap örnekleme yönü değişir.
uniform bool uInvertColormap;
// Kesit düzlemi desteği: üç.js'in yerleşik `Material.clippingPlanes`
// mekanizması SADECE üç.js'in kendi materyal shader chunk'larını (standard/
// basic/...) kullanan materyallere otomatik enjekte edilir — bu ÖZEL
// ShaderMaterial'a değil. Bu yüzden aynı world-space düzlem denklemini
// (normal·nokta+sabit ≥ 0 ise TUT, aksi halde AT — components/three/
// SectionStencilPasses.tsx'in kullandığı üç.js `clippingPlanes` ile AYNI
// yön kuralı) burada elle uyguluyoruz.
uniform bool uClipEnabled;
uniform vec3 uClipPlaneNormal;
uniform float uClipPlaneConstant;

void main() {
  if (uClipEnabled) {
    float clipDist = dot(vWorldPosition, uClipPlaneNormal) + uClipPlaneConstant;
    if (clipDist < 0.0) discard;
  }

  bool valueIsNaN = (vDamage != vDamage);
  bool valueIsInf = (abs(vDamage) > 1.0e30);
  if (valueIsNaN || valueIsInf) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, uOpacity);
    return;
  }
  float safeValue = vDamage;

  vec3 N = normalize(vNormalW);
  vec3 L = normalize(uLightDirection);
  vec3 V = normalize(cameraPosition - vWorldPosition);
  float diffuse = max(dot(N, L), 0.0);
  float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  float lambertTerm = 0.35 + 0.65 * diffuse;

  bool breached = uWallThicknessMm > 0.0 && safeValue >= uWallThicknessMm;
  if (breached) {
    float stripeCoord = (vWorldPosition.x + vWorldPosition.y) * 25.0;
    float stripe = step(0.5, fract(stripeCoord));
    vec3 hazard = mix(vec3(0.85, 0.04, 0.04), vec3(0.05, 0.05, 0.05), stripe);
    gl_FragColor = vec4(hazard * lambertTerm, uOpacity);
    return;
  }

  float range = max(uMaxValue - uMinValue, 1.0e-6);
  float t = clamp((safeValue - uMinValue) / range, 0.0, 1.0);
  float tSampled = uInvertColormap ? (1.0 - t) : t;
  vec3 baseColor = texture2D(uColormapTexture, vec2(tSampled, 0.5)).rgb;

  // İso-kontur çizgileri: sabit mm aralıklarında (uIsoStepMm), fwidth ile
  // ekran-uzayı genişliğine göre kendini ayarlayan kenar yumuşatma.
  float isoStep = max(uIsoStepMm, 1.0e-4);
  float isoCoord = safeValue / isoStep;
  float distToLine = abs(fract(isoCoord + 0.5) - 0.5);
  float isoAA = fwidth(isoCoord) * 1.5 + 1.0e-4;
  float isoIntensity = 1.0 - smoothstep(0.0, isoAA, distToLine);
  baseColor = mix(baseColor, baseColor * 0.4, isoIntensity * 0.55);

  // Eşik vurguları: kritik üstü nabız (pulse), uyarı üstü hafif sarı tint.
  if (safeValue > uThresholdCritical) {
    float pulse = 0.5 + 0.5 * sin(uTime * 4.0);
    baseColor = mix(baseColor, vec3(1.0), pulse * 0.28);
  } else if (safeValue > uThresholdWarn) {
    baseColor = mix(baseColor, vec3(1.0, 0.95, 0.55), 0.18);
  }

  vec3 lit = baseColor * lambertTerm + fresnel * 0.35;
  gl_FragColor = vec4(lit, uOpacity);
}
