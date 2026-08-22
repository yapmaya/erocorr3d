// packages/engine/src/orchestrate/index.ts
//
// orchestrate/ modülünün giriş noktası: corrosion/erosion hesap
// fonksiyonlarını gerçek MechanismResult[]/SpatialDamageField'a bağlayan
// orkestrasyon katmanı (bkz. runMechanismAssessment / assessComponentScenario).

export * from "./types";
export * from "./spatialSignatureRouting";
export * from "./mechanismRunners";
export * from "./assessComponent";
export * from "./assessScenario";
