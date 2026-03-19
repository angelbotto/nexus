import type { NexusConfig, AppConfig, GroupConfig } from "../types";

export function generateAppId(name: string, existingIds: string[]): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!existingIds.includes(base)) return base;

  let suffix = 2;
  while (existingIds.includes(`${base}-${suffix}`)) {
    suffix++;
  }
  return `${base}-${suffix}`;
}

export function addApp(config: NexusConfig, name: string, url: string): NexusConfig {
  const existingIds = config.apps.map((a) => a.id);
  const id = generateAppId(name, existingIds);
  const newApp: AppConfig = { id, name, url, group: "" };
  return { ...config, apps: [...config.apps, newApp] };
}

export function removeApp(config: NexusConfig, appId: string): NexusConfig {
  const apps = config.apps.filter((a) => a.id !== appId);
  const lastActiveAppId =
    config.lastActiveAppId === appId ? null : config.lastActiveAppId;
  return { ...config, apps, lastActiveAppId };
}

export function reorderApps(config: NexusConfig, newApps: AppConfig[]): NexusConfig {
  return { ...config, apps: newApps };
}

export function reorderGroups(config: NexusConfig, newGroups: GroupConfig[]): NexusConfig {
  return { ...config, groups: newGroups };
}

export function editApp(
  config: NexusConfig,
  appId: string,
  name: string,
  url: string
): NexusConfig {
  const apps = config.apps.map((a) =>
    a.id === appId ? { ...a, name, url } : a
  );
  return { ...config, apps };
}
