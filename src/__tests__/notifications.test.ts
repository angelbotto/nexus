import { describe, it, expect } from "vitest";
import { extractUnreadCount, computeBadgeTotal } from "../hooks/useNotifications";

describe("extractUnreadCount", () => {
  it("parses (N) prefix — single digit", () => {
    expect(extractUnreadCount("(3) Gmail")).toBe(3);
  });

  it("parses (N) prefix — multi digit", () => {
    expect(extractUnreadCount("(12) Slack | general")).toBe(12);
  });

  it("returns null for title with no (N) prefix", () => {
    expect(extractUnreadCount("Gmail - Inbox")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractUnreadCount("")).toBeNull();
  });

  it("returns null when parentheses are not at start", () => {
    expect(extractUnreadCount("New (3) messages")).toBeNull();
  });
});

describe("computeBadgeTotal", () => {
  it("sums unmuted apps with numeric counts", () => {
    const badgeMap = new Map<string, number | null>([
      ["gmail", 3],
      ["slack", 5],
    ]);
    expect(computeBadgeTotal(badgeMap, new Set())).toBe(8);
  });

  it("excludes muted apps from total", () => {
    const badgeMap = new Map<string, number | null>([
      ["gmail", 3],
      ["slack", 5],
    ]);
    expect(computeBadgeTotal(badgeMap, new Set(["slack"]))).toBe(3);
  });

  it("counts null (dot badge) as 1 for unmuted apps", () => {
    const badgeMap = new Map<string, number | null>([["gmail", null]]);
    expect(computeBadgeTotal(badgeMap, new Set())).toBe(1);
  });

  it("returns 0 for empty map", () => {
    expect(computeBadgeTotal(new Map(), new Set())).toBe(0);
  });

  it("dot badge from muted app is excluded", () => {
    const badgeMap = new Map<string, number | null>([["gmail", null]]);
    expect(computeBadgeTotal(badgeMap, new Set(["gmail"]))).toBe(0);
  });
});
