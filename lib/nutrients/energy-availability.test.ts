import { describe, expect, it } from "vitest";
import { assessEnergyAvailability, fatFreeMass, type BodyInput } from "./energy-availability";
import type { TrainingSession } from "./training";

const woman: BodyInput = { sex: "female", weightKg: 60, heightCm: 165, bodyFatPct: 20 };
// (8 − 1) METs × 60 kg × 1 h = 420 kcal
const hourHigh: TrainingSession[] = [{ minutes: 60, intensity: "high" }];

describe("fatFreeMass", () => {
  it("uses body fat % when given", () => {
    expect(fatFreeMass(woman)).toEqual({ kg: 48, estimated: false });
  });

  it("falls back to the Boer formula", () => {
    // women: 0.252 × 60 + 0.473 × 165 − 48.3 = 44.865
    const f = fatFreeMass({ ...woman, bodyFatPct: null });
    expect(f.kg).toBeCloseTo(44.865, 3);
    expect(f.estimated).toBe(true);
    // men: 0.407 × 80 + 0.267 × 180 − 19.2 = 61.42
    expect(fatFreeMass({ sex: "male", weightKg: 80, heightCm: 180 }).kg).toBeCloseTo(61.42, 3);
  });
});

describe("assessEnergyAvailability", () => {
  it("is (intake − exercise kcal) / FFM", () => {
    const ea = assessEnergyAvailability({ ...woman, intakeKcal: 2000, sessions: hourHigh });
    expect(ea.exerciseKcal).toBeCloseTo(420, 6);
    expect(ea.kcalPerKgFfm).toBeCloseTo(1580 / 48, 6);
    expect(ea.low).toBe(false);
  });

  it("flags days under ~30 kcal/kg FFM and says the threshold is debated", () => {
    const ea = assessEnergyAvailability({ ...woman, intakeKcal: 1600, sessions: hourHigh });
    expect(ea.kcalPerKgFfm).toBeCloseTo(1180 / 48, 6); // ≈ 24.6
    expect(ea.low).toBe(true);
    expect(ea.notes.join(" ")).toMatch(/debated/);
  });

  it("does not flag exactly 30 kcal/kg FFM", () => {
    expect(assessEnergyAvailability({ ...woman, intakeKcal: 1440, sessions: [] }).low).toBe(false);
  });

  it("notes when fat-free mass and exercise calories are estimates", () => {
    const ea = assessEnergyAvailability({
      ...woman,
      bodyFatPct: undefined,
      intakeKcal: 2000,
      sessions: hourHigh,
    });
    expect(ea.notes.join(" ")).toMatch(/Fat-free mass is estimated/);
    expect(ea.notes.join(" ")).toMatch(/Exercise calories are estimated/);
  });
});
