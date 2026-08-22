// packages/engine/src/registry/index.ts
//
// Kayıt defterinin giriş noktası. Bu modül ilk kez import edildiğinde
// (uygulama açılışında, packages/engine barrel'ı üzerinden) tüm katsayı
// modüllerini otomatik olarak store'a yükler.

import { registerCoefficient } from "./store";
import { ALL_COEFFICIENTS } from "./coefficients";

for (const coefficient of ALL_COEFFICIENTS) {
  registerCoefficient(coefficient);
}

export * from "./types";
export * from "./store";
export * from "./coefficients";
