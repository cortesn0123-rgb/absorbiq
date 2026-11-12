import { describe, expect, it } from "vitest";
import { formatAmount, formatNumber, formatPortion } from "./format";

describe("formatNumber", () => {
  it.each([
    [0, "0"],
    [229.68, "230"],
    [6.5934, "6.6"],
    [0.38, "0.38"],
    [0.0532, "0.053"],
    [0.0001, "<0.001"],
    [2515, "2,515"],
  ])("%d → %s", (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });
});

describe("formatAmount / formatPortion", () => {
  it("adds the unit", () => {
    expect(formatAmount(358.38, "mcg")).toBe("358 mcg");
  });

  it("describes portions", () => {
    expect(formatPortion(198, "1 cup", 1)).toBe("1 cup");
    expect(formatPortion(297, "1 cup", 1.5)).toBe("1.5 × 1 cup");
    expect(formatPortion(150, null, null)).toBe("150 g");
  });
});
