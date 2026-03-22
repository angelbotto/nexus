import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { watch } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { NexusConfig, AppConfig, GroupConfig } from "../types";
import {
  addApp as mutateAddApp,
  removeApp as mutateRemoveApp,
  reorderApps as mutateReorderApps,
  reorderGroups as mutateReorderGroups,
  editApp as mutateEditApp,
} from "../lib/configMutations";
import { extractUnreadCount, computeBadgeTotal } from "./useNotifications";

interface UseAppsConfigResult {
  config: NexusConfig | null;
  activeAppId: string | null;
  loadingAppId: string | null;
  sidebarVisible: boolean;
  badgeAppIds: Set<string>;
  badgeCounts: Map<string, number | null>;
  switchApp: (id: string) => Promise<void>;
  setActiveAppId: (id: string | null) => void;
  addApp: (name: string, url: string) => Promise<void>;
  removeApp: (appId: string) => Promise<void>;
  reorderApps: (newApps: AppConfig[]) => Promise<void>;
  reorderGroups: (newGroups: GroupConfig[]) => Promise<void>;
  editApp: (appId: string, name: string, url: string) => Promise<void>;
  toggleMute: (appId: string) => Promise<void>;
  loading: boolean;
}

export function useAppsConfig(): UseAppsConfigResult {
  const [config, setConfig] = useState<NexusConfig | null>(null);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [loadingAppId, setLoadingAppId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [badgeCounts, setBadgeCounts] = useState<Map<string, number | null>>(new Map());
  const [loading, setLoading] = useState(true);

  // Keep a ref to the latest config so mutation callbacks always see fresh state
  const configRef = useRef<NexusConfig | null>(null);
  // Track which app IDs have had their webview created (mirrors Rust AppState.webviews_created)
  const createdWebviewsRef = useRef<Set<string>>(new Set());

  // Derived badgeAppIds for backward compatibility
  const badgeAppIds = new Set(badgeCounts.keys());

  // Update dock badge whenever badgeCounts or muted apps change
  useEffect(() => {
    const mutedAppIds = new Set(config?.mutedAppIds ?? []);
    const total = computeBadgeTotal(badgeCounts, mutedAppIds);
    const win = getCurrentWindow();
    win.setBadgeCount(total > 0 ? total : undefined).catch(async () => {
      try {
        await win.setBadgeLabel(total > 0 ? String(total) : "");
      } catch (_e2) {}
    });
  }, [badgeCounts, config?.mutedAppIds]);

  useEffect(() => {
    let cancelled = false;
    const cleanupFns: Array<() => void> = [];

    async function init() {
      const loaded = await invoke<NexusConfig>("load_config");
      if (cancelled) return;
      configRef.current = loaded;
      setConfig(loaded);
      setSidebarVisible(!loaded.sidebarCollapsed);
      setLoading(false);

      const home = await homeDir();
      if (cancelled) return;
      const configPath = `${home}/.nexus/apps.json`;

      const unwatchFn = await watch(
        configPath,
        async () => {
          try {
            const updated = await invoke<NexusConfig>("reload_config");
            setConfig((prev) => {
              // JSON comparison guard — prevent watcher loops when we wrote the file ourselves
              if (JSON.stringify(prev) === JSON.stringify(updated)) return prev;
              configRef.current = updated;
              return updated;
            });
          } catch {
            // Keep showing current config if reload fails (corrupt file mid-write)
          }
        },
        { delayMs: 300 }
      );
      if (cancelled) { unwatchFn(); return; }
      cleanupFns.push(unwatchFn);
    }

    init().catch(() => setLoading(false));

    // Listen for DOM CustomEvents injected by Rust via eval() — this bypasses
    // Tauri's event system which doesn't reliably deliver to the main webview
    // when child webviews have focus.
    function handleAppSwitched(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === "string") {
        setActiveAppId(detail);
        setBadgeCounts(prev => {
          if (!prev.has(detail)) return prev;
          const next = new Map(prev);
          next.delete(detail);
          return next;
        });
      }
    }

    function handleSidebarToggle() {
      setSidebarVisible((prev) => {
        const next = !prev;
        const width = configRef.current?.sidebarWidth ?? 200;
        invoke("resize_active_webview", { sidebarVisible: next, sidebarWidth: width }).catch(() => {});
        return next;
      });
    }

    function handleTitleChanged(e: Event) {
      const { appId, title } = (e as CustomEvent<{ appId: string; title: string }>).detail;
      const count = extractUnreadCount(title);
      setBadgeCounts(prev => {
        const next = new Map(prev);
        // count is numeric if parsed, null means dot badge (title changed but no count)
        next.set(appId, count);
        return next;
      });
    }

    function handleAppLoaded(e: Event) {
      const appId = (e as CustomEvent<string>).detail;
      setLoadingAppId(prev => (prev === appId ? null : prev));
    }

    function handleSwitchToApp(e: Event) {
      const appId = (e as CustomEvent).detail?.appId;
      if (appId) switchApp(appId);
    }

    window.addEventListener("app-switched", handleAppSwitched);
    window.addEventListener("sidebar-toggle", handleSidebarToggle);
    window.addEventListener("app-title-changed", handleTitleChanged);
    window.addEventListener("app-loaded", handleAppLoaded);
    window.addEventListener("switch-to-app", handleSwitchToApp);
    cleanupFns.push(() => {
      window.removeEventListener("app-switched", handleAppSwitched);
      window.removeEventListener("sidebar-toggle", handleSidebarToggle);
      window.removeEventListener("app-title-changed", handleTitleChanged);
      window.removeEventListener("app-loaded", handleAppLoaded);
      window.removeEventListener("switch-to-app", handleSwitchToApp);
    });

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
    };
  }, []);

  async function switchApp(id: string): Promise<void> {
    setBadgeCounts(prev => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    const isFirstLoad = !createdWebviewsRef.current.has(id);
    if (isFirstLoad) {
      setLoadingAppId(id);
      createdWebviewsRef.current.add(id);
    }
    await invoke("switch_app", { appId: id });
    setActiveAppId(id);
  }

  async function persistMutation(updated: NexusConfig): Promise<void> {
    await invoke("save_config", { config: updated });
    configRef.current = updated;
    setConfig(updated);
  }

  async function addApp(name: string, url: string): Promise<void> {
    const current = configRef.current;
    if (!current) return;
    const updated = mutateAddApp(current, name, url);
    await persistMutation(updated);
  }

  async function removeApp(appId: string): Promise<void> {
    const current = configRef.current;
    if (!current) return;
    const updated = mutateRemoveApp(current, appId);
    if (appId === activeAppId) {
      await invoke("destroy_webview", { appId });
      setActiveAppId(null);
    }
    createdWebviewsRef.current.delete(appId);
    await persistMutation(updated);
  }

  async function reorderApps(newApps: AppConfig[]): Promise<void> {
    const current = configRef.current;
    if (!current) return;
    const updated = mutateReorderApps(current, newApps);
    await persistMutation(updated);
  }

  async function reorderGroups(newGroups: GroupConfig[]): Promise<void> {
    const current = configRef.current;
    if (!current) return;
    const updated = mutateReorderGroups(current, newGroups);
    await persistMutation(updated);
  }

  async function editApp(appId: string, name: string, url: string): Promise<void> {
    const current = configRef.current;
    if (!current) return;
    const updated = mutateEditApp(current, appId, name, url);
    await persistMutation(updated);
  }

  async function toggleMute(appId: string): Promise<void> {
    const current = configRef.current;
    if (!current) return;
    // Optimistic update — flip the muted state immediately so UI responds instantly
    const alreadyMuted = current.mutedAppIds.includes(appId);
    const newMutedAppIds = alreadyMuted
      ? current.mutedAppIds.filter((id) => id !== appId)
      : [...current.mutedAppIds, appId];
    const optimistic = { ...current, mutedAppIds: newMutedAppIds };
    configRef.current = optimistic;
    setConfig(optimistic);
    // Persist via Rust (also updates AppState for notification filtering)
    try {
      await invoke("toggle_mute_app", { appId });
    } catch (e) {
      console.error("toggleMute failed:", e);
      // Revert optimistic update on error
      configRef.current = current;
      setConfig(current);
    }
  }

  return {
    config,
    activeAppId,
    loadingAppId,
    sidebarVisible,
    badgeAppIds,
    badgeCounts,
    switchApp,
    setActiveAppId,
    addApp,
    removeApp,
    reorderApps,
    reorderGroups,
    editApp,
    toggleMute,
    loading,
  };
}
