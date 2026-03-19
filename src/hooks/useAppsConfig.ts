import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { watch } from "@tauri-apps/plugin-fs";
import { homeDir } from "@tauri-apps/api/path";
import type { NexusConfig } from "../types";

interface UseAppsConfigResult {
  config: NexusConfig | null;
  activeAppId: string | null;
  switchApp: (id: string) => Promise<void>;
  loading: boolean;
}

export function useAppsConfig(): UseAppsConfigResult {
  const [config, setConfig] = useState<NexusConfig | null>(null);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unwatchFn: (() => void) | null = null;

    async function init() {
      const loaded = await invoke<NexusConfig>("load_config");
      setConfig(loaded);
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
    }

    init().catch(() => setLoading(false));

    return () => {
      if (unwatchFn) {
        unwatchFn();
      }
    };
  }, []);

  async function switchApp(id: string): Promise<void> {
    await invoke("switch_app", { appId: id });
    setActiveAppId(id);
  }

  return { config, activeAppId, switchApp, loading };
}
