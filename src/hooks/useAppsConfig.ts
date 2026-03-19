import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
    let unwatchFn: (() => void) | null = null;
    let unlistenAppSwitched: (() => void) | null = null;
    let unlistenSidebarToggle: (() => void) | null = null;

    async function init() {
      const loaded = await invoke<NexusConfig>("load_config");
      setConfig(loaded);
      setSidebarVisible(!loaded.sidebarCollapsed);
      setLoading(false);

      const home = await homeDir();
      const configPath = `${home}/.nexus/apps.json`;

      unwatchFn = await watch(
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

      // Sync active app when Rust switches via keyboard shortcut (Cmd+1-9)
      unlistenAppSwitched = await listen<string>("app-switched", (event) => {
        setActiveAppId(event.payload);
      });

      // Toggle sidebar visibility when Rust emits sidebar-toggle (Cmd+B)
      unlistenSidebarToggle = await listen("sidebar-toggle", () => {
        setSidebarVisible((prev) => !prev);
      });
    }

    init().catch(() => setLoading(false));

    return () => {
      if (unwatchFn) unwatchFn();
      if (unlistenAppSwitched) unlistenAppSwitched();
      if (unlistenSidebarToggle) unlistenSidebarToggle();
    };
  }, []);

  async function switchApp(id: string): Promise<void> {
    await invoke("switch_app", { appId: id });
    setActiveAppId(id);
  }

  return { config, activeAppId, sidebarVisible, switchApp, loading };
}
