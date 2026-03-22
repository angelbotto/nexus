import { describe, it, expect } from "vitest";
import { clampWidth } from "../hooks/useSidebarResize";

describe("clampWidth", () => {
  it("returns icon-only at 48px for raw width 50 (below 80 threshold)", () => {
    expect(clampWidth(50)).toEqual({ width: 48, iconOnly: true });
  });

  it("returns icon-only at 48px for raw width 79 (boundary case)", () => {
    expect(clampWidth(79)).toEqual({ width: 48, iconOnly: true });
  });

  it("snaps to min full width 120px at threshold 80", () => {
    expect(clampWidth(80)).toEqual({ width: 120, iconOnly: false });
  });

  it("returns exact width within range for 150", () => {
    expect(clampWidth(150)).toEqual({ width: 150, iconOnly: false });
  });

  it("returns max 300px at boundary", () => {
    expect(clampWidth(300)).toEqual({ width: 300, iconOnly: false });
  });

  it("clamps to max 300px when over 400", () => {
    expect(clampWidth(400)).toEqual({ width: 300, iconOnly: false });
  });

  it("returns min full width 120px at min boundary", () => {
    expect(clampWidth(120)).toEqual({ width: 120, iconOnly: false });
  });
});
