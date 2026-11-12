import { describe, expect, it } from "vitest";
import { estimateSweatLoss, exerciseEnergyKcal } from "./training";

describe("estimateSweatLoss", () => {
  it("uses measured sweat loss when given", () => {
    expect(estimateSweatLoss([{ minutes: 60, intensity: "high", sweatLossKg: 0.8 }])).toEqual({
      kg: 0.8,
      estimatedFromTime: false,
    });
  });

  it("estimates 1 L per hour for sessions without a measurement", () => {
    expect(
      estimateSweatLoss([
        { minutes: 60, intensity: "moderate", sweatLossKg: 0.8 },
        { minutes: 30, intensity: "low" },
      ]),
    ).toEqual({ kg: 1.3, estimatedFromTime: true });
  });

  it("returns zero on rest days", () => {
    expect(estimateSweatLoss([])).toEqual({ kg: 0, estimatedFromTime: false });
  });
});

describe("exerciseEnergyKcal", () => {
  it("is (MET − 1) × kg × hours, summed over sessions", () => {
    // very high = 10 METs: 9 × 70 × 0.5 = 315; low = 3 METs: 2 × 70 × 1 = 140
    expect(
      exerciseEnergyKcal(
        [
          { minutes: 30, intensity: "very_high" },
          { minutes: 60, intensity: "low" },
        ],
        70,
      ),
    ).toBeCloseTo(455, 6);
  });

  it("is zero with no sessions", () => {
    expect(exerciseEnergyKcal([], 70)).toBe(0);
  });
});
