// packages/engine/src/version.ts
//
// Motor sürümü — package.json'daki npm sürümünden BAĞIMSIZDIR (npm sürümü
// paket yayın/bağımlılık amaçlıdır; bu sabit ise "bu sonuç hangi HESAP
// MANTIĞIYLA üretildi" sorusuna cevap verir). Kalıcı kayıtlarda (bkz.
// apps/web/src/features/projects/db.ts::AssessmentRunRecord.engineVersion)
// her sonucun yanında saklanır — motor güncellenip bu sabit artırıldığında
// eski kayıtlar "eski sürüm" olarak işaretlenip yeniden hesaplama önerilir.
//
// KURAL: corrosion/, erosion/, aggregate/, fluids/, mechanicalIntegrity/,
// registry/coefficients/ altındaki HERHANGİ bir dosyada, AYNI girdi için
// FARKLI bir sayısal sonuç üretecek bir değişiklik yapıldığında bu sabit
// elle artırılmalıdır (semver: hesap-etkileyen değişiklik → en az MINOR).
// Yorum/JSDoc/test/UI değişiklikleri bu sabiti ETKİLEMEZ.

export const ENGINE_VERSION = "0.1.0";
