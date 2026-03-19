import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { watch } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import type { NexusConfig } from "../types";

interface UseAppsConfigResult {
  config: NexusConfig | null;
  activeAppId: string | null;
  sidebarCollapsed: boolean;
  switchApp: (id: string) => Promise<void>;
  loading: boolean;
}

export function useAppsConfig(): UseAppsConfigResult {
  const [config, setConfig] = useState<NexusConfig | null>(null);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  // Track latest config ref for use inside event listeners without stale closure
  const configRef = useRef<NexusConfig | null>(null);

  useEffect(() => {
    let unwatchFn: (() => void) | null = null;

    async function init() {
      const loaded = await invoke<NexusConfig>("load_config");
      setConfig(loaded);
      configRef.current = loaded;
      setSidebarCollapsed(loaded.sidebarCollapsed);
      setLoading(false);

      // Restore last active app on startup
      if (loaded.lastActiveAppId) {
        const stillExists = loaded.apps.some((a) => a.id === loaded.lastActiveAppId);
        if (stillExists) {
          await switchAppInner(loaded.lastActiveAppId, loaded);
        }
      }

      const home = await homeDir();
      const configPath = `${home}/.nexus/apps.json`;

      unwatchFn = await watch(
        configPath,
        async () => {
          try {
            const updated = await invoke<NexusConfig>("reload_config");
            setConfig((prev) => {
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
    }

    init().catch(() => setLoading(false));

    return () => {
      if (unwatchFn) {
        unwatchFn();
      }
    };
  }, []);

  // Listen for sidebar-toggle events from Rust (Cmd+B shortcut)
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<void>("sidebar-toggle", () => {
      setSidebarCollapsed((prev) => {
        const next = !prev;
        // Persist after toggle via separate effect driven by sidebarCollapsed state
        // We schedule this outside setState to avoid async inside setState
        requestAnimationFrame(() => {
          persistSidebarCollapsed(next);
        });
        return next;
      });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Listen for app-switched events from Rust (Cmd+1-9 shortcut)
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    listen<string>("app-switched", (event) => {
      setActiveAppId(event.payload);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  async function persistSidebarCollapsed(collapsed: boolean): Promise<void> {
    const current = configRef.current;
    if (!current) return;
    const updatedConfig: NexusConfig = { ...current, sidebarCollapsed: collapsed };
    configRef.current = updatedConfig;
    setConfig(updatedConfig);
    await invoke("save_config", { config: updatedConfig });
  }

  async function switchAppInner(id: string, currentConfig: NexusConfig): Promise<void> {
    await invoke("switch_app", { appId: id });
    setActiveAppId(id);
    const updatedConfig: NexusConfig = { ...currentConfig, lastActiveAppId: id };
    configRef.current = updatedConfig;
    setConfig(updatedConfig);
    await invoke("save_config", { config: updatedConfig });
  }

  async function switchApp(id: string): Promise<void> {
    const current = configRef.current;
    if (!current) return;
    await switchAppInner(id, current);
  }

  return { config, activeAppId, sidebarCollapsed, switchApp, loading };
}
