// packages/engine/tests/data/materials.test.ts

import { describe, expect, it } from "vitest";
import { listCoefficients } from "../../src/registry";
import { MaterialSpecSchema } from "../../src/types/material";
import { MATERIALS, calculatePren, getMaterial, listMaterialsByFamily } from "../../src/data/materials";

describe("calculatePren", () => {
  it("formülü doğru uygular: PREN = %Cr + 3.3×%Mo + 16×%N", () => {
    expect(calculatePren(18, 0, 0)).toBe(18);
    expect(calculatePren(16, 2, 0.03)).toBeCloseTo(16 + 6.6 + 0.48, 6);
  });

  it("316L minimum kompozisyonuyla kullanıcının verdiği PREN=23 değerine yakın sonuç üretir", () => {
    // ASTM A240 316L: Cr min 16%, Mo min 2%, N tipik ~0.03%
    const pren = calculatePren(16, 2, 0.03);
    expect(pren).toBeCloseTo(23.08, 1);
  });

  it("negatif kompozisyon yüzdesi için hata fırlatır", () => {
    expect(() => calculatePren(-1, 2, 0.03)).toThrowError(/negatif olamaz/);
  });
});

describe("MATERIALS — veri bütünlüğü", () => {
  it("en az 20 malzeme tanımlıdır", () => {
    expect(MATERIALS.length).toBeGreaterThanOrEqual(20);
  });

  it("her malzeme MaterialSpecSchema'yı geçer", () => {
    for (const material of MATERIALS) {
      const result = MaterialSpecSchema.safeParse(material);
      expect(result.success, `${material.materialId} şema doğrulamasından geçemedi`).toBe(true);
    }
  });

  it("tüm materialId değerleri benzersizdir", () => {
    const ids = MATERIALS.map((m) => m.materialId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("kullanıcının verdiği 316L değerleri birebir korunmuştur", () => {
    const ss316 = getMaterial("ss-316-316l");
    expect(ss316.pren).toBe(23);
    expect(ss316.cptC).toBe(15);
    expect(ss316.cctC).toBe(5);
    expect(ss316.csccLimitC).toBe(60);
    expect(ss316.coatingRequiredAboveC).toBe(50);
  });

  it("kullanıcının verdiği 22Cr (2205) değerleri birebir korunmuştur", () => {
    const duplex = getMaterial("duplex-2205");
    expect(duplex.pren).toBe(35);
    expect(duplex.cptC).toBe(30);
    expect(duplex.cctC).toBe(18);
    expect(duplex.csccLimitC).toBe(100);
  });

  it("kullanıcının verdiği 25Cr (2507) değerleri birebir korunmuştur", () => {
    const superDuplex = getMaterial("super-duplex-2507");
    expect(superDuplex.pren).toBe(43);
    expect(superDuplex.cptC).toBe(80);
    expect(superDuplex.csccLimitC).toBe(110);
  });

  it("düşük sıcaklık limitleri kullanıcı talimatıyla eşleşir (CS/LTCS/DSS/3.5Ni/Ni alaşımları/östenitik)", () => {
    expect(getMaterial("cs-a106-grb").minDesignTempC).toBe(-29);
    expect(getMaterial("ltcs-a333-gr6").minDesignTempC).toBe(-45);
    expect(getMaterial("125cr-05mo-p11").minDesignTempC).toBe(-30);
    expect(getMaterial("225cr-1mo-p22").minDesignTempC).toBe(-30);
    expect(getMaterial("ni35-steel").minDesignTempC).toBe(-100);
    expect(getMaterial("duplex-2205").minDesignTempC).toBe(-50);
    expect(getMaterial("super-duplex-2507").minDesignTempC).toBe(-50);
    expect(getMaterial("alloy-625").minDesignTempC).toBe(-200);
    expect(getMaterial("alloy-825").minDesignTempC).toBe(-200);
    expect(getMaterial("ss-304-304l").minDesignTempC).toBe(-255);
    expect(getMaterial("ss-316-316l").minDesignTempC).toBe(-255);
  });

  it("metalik olmayan malzemelerde (HDPE/PP/PVC/GRE) PREN tanımlı değildir", () => {
    for (const id of ["hdpe", "pp", "pvc", "gre"]) {
      expect(getMaterial(id).pren).toBeUndefined();
    }
  });
});

describe("getMaterial / listMaterialsByFamily", () => {
  it("bilinmeyen bir kimlik için Türkçe hata fırlatır", () => {
    expect(() => getMaterial("olmayan-malzeme")).toThrowError(/bulunamadı/);
  });

  it("bilinen bir malzemeyi kimliğiyle getirir", () => {
    const cs = getMaterial("cs-a106-grb");
    expect(cs.displayNameTr).toContain("Karbon Çelik");
  });

  it("listMaterialsByFamily eşleşen malzemeleri döndürür", () => {
    const austenitic = listMaterialsByFamily("Austenitic Stainless Steel");
    expect(austenitic.length).toBeGreaterThan(0);
    expect(austenitic.every((m) => m.family === "Austenitic Stainless Steel")).toBe(true);
  });

  it("eşleşmeyen bir aile için boş liste döner", () => {
    expect(listMaterialsByFamily("Olmayan Aile")).toEqual([]);
  });
});

describe("materials — KDP kayıt defteri entegrasyonu", () => {
  it("her malzeme registry'de ayrı bir kayıt olarak bulunur", () => {
    const registered = listCoefficients().filter((c) => c.module === "materials");
    expect(registered.length).toBe(MATERIALS.length);
    for (const material of MATERIALS) {
      const entry = registered.find((c) => c.id === `data.materials.${material.materialId}`);
      expect(entry, `${material.materialId} registry'de bulunamadı`).toBeDefined();
    }
  });

  it("kullanıcı talimatından alınan malzemeler PROJECT_DOCUMENT kaynak tipini taşır", () => {
    const registered = listCoefficients().filter((c) => c.module === "materials");
    for (const id of ["ss-316-316l", "duplex-2205", "super-duplex-2507"]) {
      const entry = registered.find((c) => c.id === `data.materials.${id}`);
      expect(entry?.source.type).toBe("PROJECT_DOCUMENT");
    }
  });

  it("hiçbir malzeme confidence:HIGH taşımaz (hepsi en az bir tahmini/çapraz-doğrulanmamış alan içeriyor)", () => {
    // Bu test KDP dürüstlüğünü doğrular: hiçbir malzeme iki tamamen bağımsız kaynakla eksiksiz
    // doğrulanmadı. 316L/2205/2507 için PREN/CPT/CCT/CSCC/kaplama değerleri kullanıcının kendi iç
    // proje dokümanından geldi, ama o dokümanın kimliği izlenebilirlik amacıyla anonim tutulduğundan
    // (bkz. data/materials.ts SRC_ANONYMIZED_PROJECT_DOC_TABLE81 notu) dış doğrulama tamamlanamadı —
    // bu üç malzeme de UNVERIFIED olarak işaretli kalır.
    const registered = listCoefficients().filter((c) => c.module === "materials");
    for (const entry of registered) {
      expect(entry.confidence).not.toBe("HIGH");
    }
  });

  it("en az bir malzeme UNVERIFIED olarak işaretlenmiştir (ör. GRE)", () => {
    const gre = listCoefficients().find((c) => c.id === "data.materials.gre");
    expect(gre?.confidence).toBe("UNVERIFIED");
  });
});
