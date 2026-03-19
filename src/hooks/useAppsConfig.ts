import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { watch } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import type { NexusConfig, AppConfig, GroupConfig } from "../types";
import {
  addApp as mutateAddApp,
  removeApp as mutateRemoveApp,
  reorderApps as mutateReorderApps,
  reorderGroups as mutateReorderGroups,
  editApp as mutateEditApp,
} from "../lib/configMutations";

interface UseAppsConfigResult {
  config: NexusConfig | null;
  activeAppId: string | null;
  sidebarVisible: boolean;
  badgeAppIds: Set<string>;
  switchApp: (id: string) => Promise<void>;
  setActiveAppId: (id: string | null) => void;
  addApp: (name: string, url: string) => Promise<void>;
  removeApp: (appId: string) => Promise<void>;
  reorderApps: (newApps: AppConfig[]) => Promise<void>;
  reorderGroups: (newGroups: GroupConfig[]) => Promise<void>;
  editApp: (appId: string, name: string, url: string) => Promise<void>;
  loading: boolean;
}

export function useAppsConfig(): UseAppsConfigResult {
  const [config, setConfig] = useState<NexusConfig | null>(null);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [badgeAppIds, setBadgeAppIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Keep a ref to the latest config so mutation callbacks always see fresh state
  const configRef = useRef<NexusConfig | null>(null);

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
        setBadgeAppIds(prev => {
          if (!prev.has(detail)) return prev;
          const next = new Set(prev);
          next.delete(detail);
          return next;
        });
      }
    }

    function handleSidebarToggle() {
      setSidebarVisible((prev) => {
        const next = !prev;
        invoke("resize_active_webview", { sidebarVisible: next }).catch(() => {});
        return next;
      });
    }

    function handleTitleChanged(e: Event) {
      const { appId } = (e as CustomEvent<{ appId: string; title: string }>).detail;
      setBadgeAppIds(prev => {
        const next = new Set(prev);
        next.add(appId);
        return next;
      });
    }

    window.addEventListener("app-switched", handleAppSwitched);
    window.addEventListener("sidebar-toggle", handleSidebarToggle);
    window.addEventListener("app-title-changed", handleTitleChanged);
    cleanupFns.push(() => {
      window.removeEventListener("app-switched", handleAppSwitched);
      window.removeEventListener("sidebar-toggle", handleSidebarToggle);
      window.removeEventListener("app-title-changed", handleTitleChanged);
    });

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
    };
  }, []);

  async function switchApp(id: string): Promise<void> {
    setBadgeAppIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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

  return {
    config,
    activeAppId,
    sidebarVisible,
    badgeAppIds,
    switchApp,
    setActiveAppId,
    addApp,
    removeApp,
    reorderApps,
    reorderGroups,
    editApp,
    loading,
  };
}
