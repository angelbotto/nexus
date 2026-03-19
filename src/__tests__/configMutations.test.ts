import { describe, it, expect } from "vitest";
import {
  generateAppId,
  addApp,
  removeApp,
  reorderApps,
  reorderGroups,
  editApp,
} from "../lib/configMutations";
import type { NexusConfig, AppConfig, GroupConfig } from "../types";

function makeConfig(overrides: Partial<NexusConfig> = {}): NexusConfig {
  return {
    groups: [],
    apps: [],
    lastActiveAppId: null,
    sidebarCollapsed: false,
    ...overrides,
  };
}

function makeApp(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    id: "test-app",
    name: "Test App",
    url: "https://example.com",
    group: "",
    ...overrides,
  };
}

function makeGroup(overrides: Partial<GroupConfig> = {}): GroupConfig {
  return {
    id: "group-1",
    name: "Group 1",
    collapsed: false,
    ...overrides,
  };
}

// ---------- generateAppId ----------

describe("generateAppId", () => {
  it("slugifies a normal name", () => {
    expect(generateAppId("My Cool App", [])).toBe("my-cool-app");
  });

  it("strips special characters", () => {
    expect(generateAppId("App @#$% Name", [])).toBe("app-name");
  });

  it("handles single word names", () => {
    expect(generateAppId("Gmail", [])).toBe("gmail");
  });

  it("appends -2 on first collision", () => {
    expect(generateAppId("My App", ["my-app"])).toBe("my-app-2");
  });

  it("increments suffix beyond -2 to avoid all collisions", () => {
    expect(generateAppId("My App", ["my-app", "my-app-2"])).toBe("my-app-3");
  });

  it("collapses multiple spaces/hyphens into one", () => {
    expect(generateAppId("App  --  Name", [])).toBe("app-name");
  });
});

// ---------- addApp ----------

describe("addApp", () => {
  it("appends a new app to the apps array", () => {
    const config = makeConfig();
    const result = addApp(config, "GitHub", "https://github.com");
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].name).toBe("GitHub");
    expect(result.apps[0].url).toBe("https://github.com");
  });

  it("assigns an empty string group (Other bucket)", () => {
    const config = makeConfig();
    const result = addApp(config, "GitHub", "https://github.com");
    expect(result.apps[0].group).toBe("");
  });

  it("auto-generates an id from the name", () => {
    const config = makeConfig();
    const result = addApp(config, "GitHub", "https://github.com");
    expect(result.apps[0].id).toBe("github");
  });

  it("does not mutate the input config", () => {
    const config = makeConfig();
    const original = JSON.stringify(config);
    addApp(config, "GitHub", "https://github.com");
    expect(JSON.stringify(config)).toBe(original);
  });

  it("handles id collision when another app has the same slug", () => {
    const config = makeConfig({ apps: [makeApp({ id: "github" })] });
    const result = addApp(config, "GitHub", "https://github.com");
    expect(result.apps[1].id).toBe("github-2");
  });
});

// ---------- removeApp ----------

describe("removeApp", () => {
  it("removes the specified app by ID", () => {
    const config = makeConfig({ apps: [makeApp({ id: "app-1" }), makeApp({ id: "app-2" })] });
    const result = removeApp(config, "app-1");
    expect(result.apps).toHaveLength(1);
    expect(result.apps[0].id).toBe("app-2");
  });

  it("clears lastActiveAppId when removing the active app", () => {
    const config = makeConfig({
      apps: [makeApp({ id: "app-1" })],
      lastActiveAppId: "app-1",
    });
    const result = removeApp(config, "app-1");
    expect(result.lastActiveAppId).toBeNull();
  });

  it("does not clear lastActiveAppId when removing a non-active app", () => {
    const config = makeConfig({
      apps: [makeApp({ id: "app-1" }), makeApp({ id: "app-2" })],
      lastActiveAppId: "app-2",
    });
    const result = removeApp(config, "app-1");
    expect(result.lastActiveAppId).toBe("app-2");
  });

  it("returns config unchanged when app ID does not exist", () => {
    const config = makeConfig({ apps: [makeApp({ id: "app-1" })] });
    const result = removeApp(config, "nonexistent");
    expect(result.apps).toHaveLength(1);
  });
});

// ---------- reorderApps ----------

describe("reorderApps", () => {
  it("replaces the apps array with the provided one", () => {
    const apps: AppConfig[] = [
      makeApp({ id: "b" }),
      makeApp({ id: "a" }),
    ];
    const config = makeConfig({ apps: [makeApp({ id: "a" }), makeApp({ id: "b" })] });
    const result = reorderApps(config, apps);
    expect(result.apps[0].id).toBe("b");
    expect(result.apps[1].id).toBe("a");
  });
});

// ---------- reorderGroups ----------

describe("reorderGroups", () => {
  it("replaces the groups array with the provided one", () => {
    const groups: GroupConfig[] = [makeGroup({ id: "g2" }), makeGroup({ id: "g1" })];
    const config = makeConfig({ groups: [makeGroup({ id: "g1" }), makeGroup({ id: "g2" })] });
    const result = reorderGroups(config, groups);
    expect(result.groups[0].id).toBe("g2");
    expect(result.groups[1].id).toBe("g1");
  });
});

// ---------- editApp ----------

describe("editApp", () => {
  it("updates name and url for the matching app ID", () => {
    const config = makeConfig({ apps: [makeApp({ id: "app-1", name: "Old", url: "https://old.com" })] });
    const result = editApp(config, "app-1", "New Name", "https://new.com");
    expect(result.apps[0].name).toBe("New Name");
    expect(result.apps[0].url).toBe("https://new.com");
  });

  it("preserves other fields when editing", () => {
    const config = makeConfig({ apps: [makeApp({ id: "app-1", group: "work" })] });
    const result = editApp(config, "app-1", "New Name", "https://new.com");
    expect(result.apps[0].group).toBe("work");
    expect(result.apps[0].id).toBe("app-1");
  });

  it("returns config unchanged when app ID does not exist", () => {
    const config = makeConfig({ apps: [makeApp({ id: "app-1" })] });
    const result = editApp(config, "nonexistent", "X", "https://x.com");
    expect(result.apps[0].name).toBe("Test App");
  });
});
