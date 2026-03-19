import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { watch } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import type { NexusConfig } from "../types";

interface UseAppsConfigResult {
  config: NexusConfig | null;
  activeAppId: string | null;
  sidebarVisible: boolean;
  switchApp: (id: string) => Promise<void>;
  loading: boolean;
}

export function useAppsConfig(): UseAppsConfigResult {
  const [config, setConfig] = useState<NexusConfig | null>(null);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const cleanupFns: Array<() => void> = [];

    async function init() {
      const loaded = await invoke<NexusConfig>("load_config");
      if (cancelled) return;
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
            setConfig(updated);
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
      }
    }

    function handleSidebarToggle() {
      setSidebarVisible((prev) => {
        const next = !prev;
        invoke("resize_active_webview", { sidebarVisible: next }).catch(() => {});
        return next;
      });
    }

    window.addEventListener("app-switched", handleAppSwitched);
    window.addEventListener("sidebar-toggle", handleSidebarToggle);
    cleanupFns.push(() => {
      window.removeEventListener("app-switched", handleAppSwitched);
      window.removeEventListener("sidebar-toggle", handleSidebarToggle);
    });

    return () => {
      cancelled = true;
      for (const fn of cleanupFns) fn();
    };
  }, []);

  async function switchApp(id: string): Promise<void> {
    await invoke("switch_app", { appId: id });
    setActiveAppId(id);
  }

  return { config, activeAppId, sidebarVisible, switchApp, loading };
}
