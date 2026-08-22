// apps/web/src/shaders/heatmap.vert.glsl
//
// Isı haritası vertex shader'ı. `damage` attribute'u her zaman "mm cinsinden
// aşınma" anlamına gelmeyebilir — çağıran taraf (bkz. damageHeatmapMaterial.ts)
// seçili görselleştirme moduna göre FARKLI bir skaler diziyi bu attribute'a
// yazabilir (KALAN DUVAR / HIZ / KALAN ÖMÜR / ...); isim, geometrinin zaten
// `geometry/helpers.ts::allocateDamageAttribute` ile ayırdığı attribute ile
// tutarlılık için korunmuştur.
//
// Deformasyon modu: duvarı `damage` kadar (mm→m, `uDeformExaggeration` ile
// abartılmış) YEREL NORMAL yönünde içeri kaydırır — aşınmış/çukurlu bir
// görünüm için. Yalnızca görselleştirme amaçlıdır, gerçek bir FEM/mesh-
// morphing değildir.

precision highp float;

attribute float damage;

uniform bool uDeformEnabled;
uniform float uDeformExaggeration;

varying float vDamage;
varying vec3 vNormalW;
varying vec3 vWorldPosition;

void main() {
  vDamage = damage;

  vec3 displaced = position;
  if (uDeformEnabled) {
    float deformM = (damage / 1000.0) * uDeformExaggeration;
    displaced -= normal * deformM;
  }

  vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
  vWorldPosition = worldPosition.xyz;
  vNormalW = normalize(normalMatrix * normal);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
