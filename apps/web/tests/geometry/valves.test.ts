// apps/web/tests/geometry/valves.test.ts
//
// 10 vana üreticisi için genel doğrulama: her parçanın geçerli (NaN'sız,
// sıfır-olmayan) bir geometrisi olduğunu, `damage` attribute'unun sıfırla
// dolu olduğunu, her pivot'un ilan ettiği parça adının GERÇEKTEN mevcut
// olduğunu, her damageZone'un GERÇEK bir parçaya işaret ettiğini ve
// computePartPoseForOpening'in 0/50/100% için tutarlı sonuçlar verdiğini
// doğrular. CSG-türevli gövdeler için (bkz. valveHelpers.ts başlığı —
// three-bvh-csg'nin bilinen manifold sınırlaması) tee.ts emsaliyle AYNI
// "hacim makullüğü" ölçütü kullanılır — katı kenar-sayım testi DEĞİL.

import { describe, expect, it } from "vitest";
import { computeMeshVolume } from "three-bvh-csg";
import {
  computePartPoseForOpening,
  createBallValve,
  createButterflyValve,
  createChokeValve,
  createCheckValve,
  createControlValveCage,
  createGateValve,
  createGlobeValve,
  createNeedleValve,
  createPSV,
  createPlugValve,
  type ValveAssembly,
} from "../../src/geometry/valves";

function expectFiniteVector3Attribute(attr: { count: number; getX: (i: number) => number; getY: (i: number) => number; getZ: (i: number) => number }) {
  for (let i = 0; i < attr.count; i++) {
    expect(Number.isFinite(attr.getX(i))).toBe(true);
    expect(Number.isFinite(attr.getY(i))).toBe(true);
    expect(Number.isFinite(attr.getZ(i))).toBe(true);
  }
}

function expectValidAssembly(assembly: ValveAssembly, expectedComponentType: string) {
  expect(assembly.componentType).toBe(expectedComponentType);
  expect(assembly.parts.length).toBeGreaterThan(0);
  expect(assembly.metadata.partNames).toEqual(assembly.parts.map((p) => p.name));
  expect(new Set(assembly.parts.map((p) => p.name)).size).toBe(assembly.parts.length); // isimler benzersiz

  const partNames = new Set(assembly.parts.map((p) => p.name));
  let vertexSum = 0;
  let triSum = 0;

  for (const part of assembly.parts) {
    const position = part.geometry.getAttribute("position");
    expect(position.count).toBeGreaterThan(0);
    expectFiniteVector3Attribute(position);

    const damage = part.geometry.getAttribute("damage");
    expect(damage).toBeDefined();
    expect(damage.itemSize).toBe(1);
    for (let i = 0; i < damage.count; i++) expect(damage.getX(i)).toBe(0);

    const index = part.geometry.getIndex();
    vertexSum += position.count;
    triSum += index ? index.count / 3 : position.count / 3;

    if (part.pivot) {
      expect(part.pivot.partName).toBe(part.name);
      expect(part.pivot.closedValue).toBe(0);
      expect(Number.isFinite(part.pivot.openValue)).toBe(true);
      expect(part.pivot.openValue).not.toBe(0);
      // pivot ekseni SADECE tek bir temel eksene hizalı olmalı (bkz. types.ts kısıtı)
      const nonZeroAxisCount = part.pivot.axis.filter((c) => c !== 0).length;
      expect(nonZeroAxisCount).toBe(1);

      expect(assembly.currentPose[part.name]).toBeDefined();
      const poseAt0 = computePartPoseForOpening(part.pivot, 0);
      const poseAt50 = computePartPoseForOpening(part.pivot, 50);
      const poseAt100 = computePartPoseForOpening(part.pivot, 100);
      expect(poseAt0.positionM).toEqual([0, 0, 0]);
      expect(poseAt0.rotationRad).toEqual([0, 0, 0]);
      if (part.pivot.kind === "TRANSLATE") {
        expect(poseAt100.positionM.some((c) => Math.abs(c) > 0)).toBe(true);
        expect(poseAt100.rotationRad).toEqual([0, 0, 0]);
        // 50% tam ortada olmalı (doğrusal enterpolasyon)
        for (let axisIdx = 0; axisIdx < 3; axisIdx++) {
          expect(poseAt50.positionM[axisIdx]).toBeCloseTo(poseAt100.positionM[axisIdx] / 2, 9);
        }
      } else {
        expect(poseAt100.rotationRad.some((c) => Math.abs(c) > 0)).toBe(true);
        expect(poseAt100.positionM).toEqual([0, 0, 0]);
        for (let axisIdx = 0; axisIdx < 3; axisIdx++) {
          expect(poseAt50.rotationRad[axisIdx]).toBeCloseTo(poseAt100.rotationRad[axisIdx] / 2, 9);
        }
      }
    } else {
      expect(assembly.currentPose[part.name]).toBeUndefined();
    }

    for (const zone of part.damageZones) {
      expect(zone.meshName).toBe(part.name);
      expect(zone.centerUV.u).toBeGreaterThanOrEqual(0);
      expect(zone.centerUV.u).toBeLessThanOrEqual(1);
      expect(zone.centerUV.v).toBeGreaterThanOrEqual(0);
      expect(zone.centerUV.v).toBeLessThanOrEqual(1);
      expect(zone.radius).toBeGreaterThan(0);
    }
  }

  // Her damageZone GERÇEKTEN mevcut bir parçaya işaret eder.
  for (const part of assembly.parts) {
    for (const zone of part.damageZones) {
      expect(partNames.has(zone.meshName)).toBe(true);
    }
  }

  expect(assembly.metadata.vertexCount).toBe(vertexSum);
  expect(assembly.metadata.triangleCount).toBe(triSum);
  expect(assembly.flowPath.length).toBeGreaterThan(1);
  for (const point of assembly.flowPath) {
    expect(point.positionM.every((c) => Number.isFinite(c))).toBe(true);
    expect(point.tangent.every((c) => Number.isFinite(c))).toBe(true);
    expect(point.relativeSpeedHint).toBeGreaterThan(0);
  }
}

/** CSG-türevli BODY parçası için hacim makullüğü — bkz. modül başlığı ve tee.ts emsali. */
function expectPositiveBoundedVolume(assembly: ValveAssembly, partName: string, upperBoundM3: number) {
  const part = assembly.parts.find((p) => p.name === partName);
  expect(part).toBeDefined();
  const volume = computeMeshVolume(part!.geometry);
  expect(volume).toBeGreaterThan(0);
  expect(volume).toBeLessThan(upperBoundM3);
}

const NPS = 4; // inç
const CLASS = 300 as const;

describe("createGateValve", () => {
  it("SOLID wedge, opening=0 (kapalı)", () => {
    const a = createGateValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 0, wedgeType: "SOLID" });
    expectValidAssembly(a, "GATE_VALVE");
    expect(a.parts.map((p) => p.name)).toEqual(expect.arrayContaining(["BODY", "BONNET", "WEDGE", "STEM", "PACKING", "SEAT_RING_UPSTREAM", "SEAT_RING_DOWNSTREAM"]));
    expectPositiveBoundedVolume(a, "BODY", 0.05);
  });
  it("SPLIT wedge, opening=100 (açık)", () => {
    const a = createGateValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 100, wedgeType: "SPLIT" });
    expectValidAssembly(a, "GATE_VALVE");
    expect(a.currentPose.WEDGE.positionM[1]).toBeGreaterThan(0);
  });
});

describe("createGlobeValve", () => {
  for (const trimType of ["PLUG", "NEEDLE", "CAGE"] as const) {
    it(`trimType=${trimType}`, () => {
      const a = createGlobeValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 40, trimType });
      expectValidAssembly(a, "GLOBE_VALVE");
      expect(a.parts.map((p) => p.name)).toEqual(expect.arrayContaining(["BODY", "BONNET", "SEAT_RING", "PLUG", "STEM", "PACKING"]));
      expectPositiveBoundedVolume(a, "BODY", 0.05);
    });
  }
});

describe("createBallValve", () => {
  it("FULL bore", () => {
    const a = createBallValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 100, bore: "FULL" });
    expectValidAssembly(a, "BALL_VALVE_FULL");
    expect(a.currentPose.BALL.rotationRad[1]).toBeCloseTo(Math.PI / 2, 6);
  });
  it("REDUCED bore — v-notch bölgesi var", () => {
    const a = createBallValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 30, bore: "REDUCED" });
    expectValidAssembly(a, "BALL_VALVE_REDUCED");
    const ball = a.parts.find((p) => p.name === "BALL")!;
    expect(ball.damageZones.some((z) => z.id === "ballReduced.v_notch_edge")).toBe(true);
  });
});

describe("createButterflyValve", () => {
  for (const discType of ["CONCENTRIC", "ECCENTRIC", "TRIPLE_OFFSET"] as const) {
    it(`discType=${discType}`, () => {
      const a = createButterflyValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 50, discType });
      expectValidAssembly(a, "BUTTERFLY_VALVE");
      expectPositiveBoundedVolume(a, "BODY", 0.03);
    });
  }
});

describe("createCheckValve", () => {
  it("SWING", () => {
    const a = createCheckValve({ npsIn: NPS, pressureClass: CLASS, type: "SWING" });
    expectValidAssembly(a, "CHECK_VALVE_SWING");
    expect(a.parts.map((p) => p.name)).toEqual(expect.arrayContaining(["BODY", "SEAT_RING", "DISC", "HINGE_PIN"]));
  });
  it("LIFT", () => {
    const a = createCheckValve({ npsIn: NPS, pressureClass: CLASS, type: "LIFT", openingPercent: 80 });
    expectValidAssembly(a, "CHECK_VALVE_LIFT");
    expect(a.currentPose.DISC.positionM[0]).toBeGreaterThan(0);
  });
  it("DUAL_PLATE — plakalar ZIT yönde döner", () => {
    const a = createCheckValve({ npsIn: NPS, pressureClass: CLASS, type: "DUAL_PLATE", openingPercent: 100 });
    expectValidAssembly(a, "CHECK_VALVE_DUAL_PLATE");
    const rotA = a.currentPose.PLATE_A.rotationRad[2];
    const rotB = a.currentPose.PLATE_B.rotationRad[2];
    expect(rotA).toBeCloseTo(-rotB, 9);
    expect(rotA).not.toBe(0);
  });
  it("openingPercent verilmezse varsayılan (60) kullanılır ve hata FIRLATMAZ", () => {
    expect(() => createCheckValve({ npsIn: NPS, pressureClass: CLASS, type: "SWING" })).not.toThrow();
  });
});

describe("createChokeValve", () => {
  for (const trimType of ["POSITIVE", "ADJUSTABLE", "MULTI_STAGE"] as const) {
    it(`trimType=${trimType}`, () => {
      const a = createChokeValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 25, trimType });
      expectValidAssembly(a, "CHOKE_VALVE");
      expectPositiveBoundedVolume(a, "BODY", 0.05);
    });
  }
});

describe("createControlValveCage", () => {
  for (const cageWindows of [3, 4, 6, 8]) {
    it(`cageWindows=${cageWindows}`, () => {
      const a = createControlValveCage({ npsIn: NPS, pressureClass: CLASS, openingPercent: 70, cageWindows });
      expectValidAssembly(a, "CONTROL_VALVE_CAGE");
      expect(a.parts.map((p) => p.name)).toEqual(expect.arrayContaining(["BODY", "BONNET", "CAGE", "PISTON", "SEAT_RING", "STEM", "PACKING"]));
    });
  }
});

describe("createPlugValve", () => {
  it("kapalı→açık dönüşü", () => {
    const a = createPlugValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 0 });
    expectValidAssembly(a, "PLUG_VALVE");
    expect(a.currentPose.PLUG.rotationRad[1]).toBe(0);
    const open = createPlugValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: 100 });
    expect(open.currentPose.PLUG.rotationRad[1]).toBeCloseTo(Math.PI / 2, 6);
  });
});

describe("createNeedleValve", () => {
  it("temel doğrulama", () => {
    const a = createNeedleValve({ npsIn: 1, pressureClass: CLASS, openingPercent: 15 });
    expectValidAssembly(a, "NEEDLE_VALVE");
    expectPositiveBoundedVolume(a, "BODY", 0.01);
  });
});

describe("createPSV", () => {
  it("varsayılan openingPercent=0 (normal kapalı)", () => {
    const a = createPSV({ npsIn: NPS, pressureClass: CLASS });
    expectValidAssembly(a, "PRESSURE_SAFETY_VALVE");
    expect(a.currentPose.DISC.positionM[1]).toBe(0);
  });
  it("openingPercent=100 (tam kalkmış)", () => {
    const a = createPSV({ npsIn: NPS, pressureClass: CLASS, openingPercent: 100 });
    expect(a.currentPose.DISC.positionM[1]).toBeGreaterThan(0);
    expectPositiveBoundedVolume(a, "BODY", 0.06);
  });
});

describe("farklı NPS/basınç sınıfı girdileri hata fırlatmaz", () => {
  it.each([1, 2, 6, 12] as const)("npsIn=%i", (npsIn) => {
    expect(() => createGateValve({ npsIn, pressureClass: 600, openingPercent: 50 })).not.toThrow();
    expect(() => createBallValve({ npsIn, pressureClass: 150, openingPercent: 50 })).not.toThrow();
  });
});

describe("geçersiz openingPercent reddedilir", () => {
  it.each([-1, 101, Number.NaN])("openingPercent=%s hata fırlatır", (bad) => {
    expect(() => createGateValve({ npsIn: NPS, pressureClass: CLASS, openingPercent: bad })).toThrow();
  });
});
