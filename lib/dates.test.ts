import { describe, expect, it } from "vitest";
import { addDays, formatDayLabel, hourIn, isIsoDate, todayIn } from "./dates";

describe("isIsoDate", () => {
  it("accepts real calendar dates only", () => {
    expect(isIsoDate("2026-11-11")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("11/11/2026")).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(isIsoDate(["2026-11-11"])).toBe(false);
  });
});

describe("todayIn / hourIn", () => {
  // 03:30 UTC on Nov 11 is still Nov 10 in Los Angeles.
  const now = new Date("2026-11-11T03:30:00Z");

  it("uses the user's time zone", () => {
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-11-10");
    expect(todayIn("Asia/Tokyo", now)).toBe("2026-11-11");
    expect(hourIn("America/Los_Angeles", now)).toBe(19);
    expect(hourIn("UTC", new Date("2026-11-11T00:15:00Z"))).toBe(0);
  });

  it("falls back to UTC for a missing or invalid zone", () => {
    expect(todayIn(undefined, now)).toBe("2026-11-11");
    expect(todayIn("Not/AZone", now)).toBe("2026-11-11");
  });
});

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
});

describe("formatDayLabel", () => {
  it("names nearby days and formats others", () => {
    expect(formatDayLabel("2026-11-11", "2026-11-11")).toBe("Today");
    expect(formatDayLabel("2026-11-10", "2026-11-11")).toBe("Yesterday");
    expect(formatDayLabel("2026-11-12", "2026-11-11")).toBe("Tomorrow");
    expect(formatDayLabel("2026-11-02", "2026-11-11")).toBe("Mon, Nov 2");
    expect(formatDayLabel("2025-11-02", "2026-11-11")).toBe("Sun, Nov 2, 2025");
  });
});
