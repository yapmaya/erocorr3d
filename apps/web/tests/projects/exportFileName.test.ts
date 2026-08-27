// apps/web/tests/projects/exportFileName.test.ts
//
// REGRESYON: `toSafeFileName`, proje adı olarak KULLANICI METNİ alır ve bunu
// `.ec3d` indirme dosyası adında kullanır (bkz. exportProject.ts::
// downloadEc3dFile). Kontrol edilmemiş kullanıcı metni ("../../../etc/passwd",
// null byte, çok uzun adlar) doğrudan `anchor.download`a geçiyordu.

import { describe, expect, it } from "vitest";
import { toSafeFileName } from "../../src/features/projects/exportProject";

describe("toSafeFileName", () => {
  it("olağan bir proje adını değiştirmeden bırakır", () => {
    expect(toSafeFileName("Kuyu-12 Hat A")).toBe("Kuyu-12 Hat A");
  });

  it("yol ayırıcılarını ve Windows'ta yasak karakterleri tire ile değiştirir", () => {
    expect(toSafeFileName("../../../etc/passwd")).toBe("..-..-..-etc-passwd");
    expect(toSafeFileName("a/b\\c")).toBe("a-b-c");
    expect(toSafeFileName('rapor:adı*?"<>|.ec3d')).toBe("rapor-adı------.ec3d");
  });

  it("kontrol karakterlerini ve null byte'ı atar", () => {
    const nullByte = String.fromCharCode(0);
    expect(toSafeFileName(`rapor${nullByte}.exe`)).toBe("rapor.exe");
    expect(toSafeFileName("a\nb")).toBe("ab");
  });

  it("300+ karakterlik adları makul bir uzunluğa sınırlar", () => {
    const longName = "a".repeat(300);
    const result = toSafeFileName(longName);
    expect(result.length).toBeLessThan(300);
    expect(result.length).toBeGreaterThan(0);
  });

  it("boş veya yalnızca boşluktan oluşan adlar varsayılana düşer", () => {
    expect(toSafeFileName("")).toBe("erocorr3d-proje");
    expect(toSafeFileName("   ")).toBe("erocorr3d-proje");
  });
});
