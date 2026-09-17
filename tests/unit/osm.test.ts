import { describe, expect, it } from "vitest";

import { openState, tileForCoords } from "@/lib/utils/osm";

/**
 * UI_Plan.md §7.4: "If parsing is uncertain, show the raw string only — never
 * guess."
 *
 * The "unknown" cases below are the important half of this suite. A wrong
 * "Open now" sends someone across town for nothing; returning "unknown" just
 * shows the raw hours, which is always correct.
 */

/** Wednesday 2024-05-15, 14:30 local. */
const wedAfternoon = new Date(2024, 4, 15, 14, 30);
/** Wednesday 2024-05-15, 02:30 local — inside a span that began Tuesday night. */
const wedEarlyHours = new Date(2024, 4, 15, 2, 30);
/** Sunday 2024-05-19, 14:30 local. */
const sunAfternoon = new Date(2024, 4, 19, 14, 30);

describe("openState", () => {
  it("treats 24/7 as always open", () => {
    expect(openState("24/7", wedAfternoon)).toBe("open");
  });

  it("reads a simple every-day span", () => {
    expect(openState("Mo-Su 12:00-23:00", wedAfternoon)).toBe("open");
    expect(openState("Mo-Su 18:00-23:00", wedAfternoon)).toBe("closed");
  });

  it("respects the day range", () => {
    expect(openState("Mo-Fr 09:00-17:00", wedAfternoon)).toBe("open");
    expect(openState("Mo-Fr 09:00-17:00", sunAfternoon)).toBe("closed");
  });

  it("handles a comma-separated day list", () => {
    expect(openState("Mo,We,Fr 10:00-18:00", wedAfternoon)).toBe("open");
    expect(openState("Mo,Tu,Th 10:00-18:00", wedAfternoon)).toBe("closed");
  });

  it("handles several rules separated by semicolons", () => {
    expect(openState("Mo-Fr 09:00-12:00; Sa 10:00-14:00", wedAfternoon)).toBe("closed");
    expect(openState("Mo-Fr 09:00-12:00; We 14:00-18:00", wedAfternoon)).toBe("open");
  });

  it("handles multiple spans in one rule", () => {
    expect(openState("Mo-Fr 09:00-12:00,14:00-18:00", wedAfternoon)).toBe("open");
    expect(openState("Mo-Fr 09:00-12:00,16:00-18:00", wedAfternoon)).toBe("closed");
  });

  it("handles a span that crosses midnight", () => {
    // Tuesday's 20:00–04:00 is still running at 02:30 on Wednesday.
    expect(openState("Mo-Tu 20:00-04:00", wedEarlyHours)).toBe("open");
    expect(openState("Mo-Tu 20:00-04:00", wedAfternoon)).toBe("closed");
  });

  it("wraps a day range that crosses the end of the week", () => {
    expect(openState("Fr-Mo 09:00-17:00", sunAfternoon)).toBe("open");
    expect(openState("Fr-Mo 09:00-17:00", wedAfternoon)).toBe("closed");
  });

  describe("refuses to guess", () => {
    it.each([
      ["PH off", "public holiday rules"],
      ["Mo-Fr 09:00-17:00; PH off", "a holiday exception mixed into a simple rule"],
      ["sunrise-sunset", "solar times"],
      ["Apr-Oct Mo-Su 10:00-20:00", "a seasonal range"],
      ["Mo-Fr 09:00+", "an open-ended span"],
      ["by appointment", "free text"],
      ["Xx-Yy 09:00-17:00", "an unknown day token"],
      ["Mo-Fr 9-17", "times that are not clock values"],
    ])("returns unknown for %s (%s)", (value) => {
      expect(openState(value, wedAfternoon)).toBe("unknown");
    });

    it("returns unknown for an absent value", () => {
      expect(openState(null, wedAfternoon)).toBe("unknown");
      expect(openState("", wedAfternoon)).toBe("unknown");
      expect(openState("   ", wedAfternoon)).toBe("unknown");
    });
  });
});

/**
 * The inverse slippy-map transform: the north-west corner of a tile.
 *
 * Written out so the tests below check a *property* — "the tile we picked
 * actually contains the coordinate" — rather than asserting a magic number that
 * was copied from the implementation's own output and would therefore agree
 * with it even if both were wrong.
 */
function tileNorthWest(x: number, y: number, z: number): { lat: number; lon: number } {
  const n = 2 ** z;
  const lon = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  return { lat: (latRad * 180) / Math.PI, lon };
}

describe("tileForCoords", () => {
  it.each([
    ["Hamra, Beirut", 33.8959, 35.4784],
    ["Paris", 48.8566, 2.3522],
    ["southern hemisphere", -33.8688, 151.2093],
    ["west of Greenwich", 40.7128, -74.006],
  ])("returns a tile that contains %s", (_name, lat, lon) => {
    const { x, y, z } = tileForCoords(lat, lon);

    const topLeft = tileNorthWest(x, y, z);
    const bottomRight = tileNorthWest(x + 1, y + 1, z);

    expect(lon).toBeGreaterThanOrEqual(topLeft.lon);
    expect(lon).toBeLessThan(bottomRight.lon);
    // y grows southward, so the tile's top edge is the higher latitude.
    expect(lat).toBeLessThanOrEqual(topLeft.lat);
    expect(lat).toBeGreaterThan(bottomRight.lat);
  });

  it("maps the origin to the middle of the grid", () => {
    expect(tileForCoords(0, 0, 2)).toEqual({ x: 2, y: 2, z: 2 });
  });

  it("stays inside the grid at the extremes of the projection", () => {
    const n = 2 ** 16;
    for (const [lat, lon] of [
      [85, 179.9],
      [-85, -180],
    ] as const) {
      const { x, y } = tileForCoords(lat, lon);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(n);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThan(n);
    }
  });
});
