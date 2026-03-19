import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
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
    invoke<NexusConfig>("load_config")
      .then(setConfig)
      .finally(() => setLoading(false));
  }, []);

  async function switchApp(id: string): Promise<void> {
    await invoke("switch_app", { appId: id });
    setActiveAppId(id);
  }

  return { config, activeAppId, switchApp, loading };
}
