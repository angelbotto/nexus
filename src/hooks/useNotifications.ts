import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NexusConfig } from "../types";

export function extractUnreadCount(title: string): number | null {
  const match = /^\((\d+)\)/.exec(title);
  if (!match) return null;
  return parseInt(match[1], 10);
}

export function computeBadgeTotal(
  badgeMap: Map<string, number | null>,
  mutedAppIds: Set<string>
): number {
  let total = 0;
  for (const [appId, count] of badgeMap) {
    if (mutedAppIds.has(appId)) continue;
    total += count === null ? 1 : count;
  }
  return total;
}

interface UseNotificationsResult {
  mutedAppIds: Set<string>;
  dndEnabled: boolean;
  toggleMute: (appId: string) => Promise<void>;
  setDnd: (enabled: boolean) => Promise<void>;
}

export function useNotifications(config: NexusConfig | null): UseNotificationsResult {
  const mutedAppIds = useMemo(
    () => new Set(config?.mutedAppIds ?? []),
    [config?.mutedAppIds]
  );
  const dndEnabled = config?.dndEnabled ?? false;

  async function toggleMute(appId: string): Promise<void> {
    await invoke("toggle_mute_app", { appId });
    await invoke("reload_config");
  }

  async function setDnd(enabled: boolean): Promise<void> {
    await invoke("set_dnd", { enabled });
    await invoke("reload_config");
  }

  return { mutedAppIds, dndEnabled, toggleMute, setDnd };
}
