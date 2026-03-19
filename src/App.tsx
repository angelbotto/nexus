import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppsConfig } from "./hooks/useAppsConfig";
import { Sidebar } from "./components/Sidebar";
import type { NexusConfig } from "./types";

function App() {
  const { config: hookConfig, activeAppId, switchApp, loading } = useAppsConfig();
  const [config, setConfig] = useState<NexusConfig | null>(null);

  useEffect(() => {
    if (hookConfig) {
      setConfig(hookConfig);
    }
  }, [hookConfig]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-500">
        Failed to load config
      </div>
    );
  }

  async function handleGroupToggle(groupId: string): Promise<void> {
    if (!config) return;
    const updatedGroups = config.groups.map((g) =>
      g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
    );
    const updatedConfig: NexusConfig = { ...config, groups: updatedGroups };
    await invoke("save_config", { config: updatedConfig });
    setConfig(updatedConfig);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950">
      {!config.sidebarCollapsed && (
        <Sidebar
          config={config}
          activeAppId={activeAppId}
          onSwitch={switchApp}
          onGroupToggle={handleGroupToggle}
        />
      )}
      <main className="flex flex-1 p-2">
        <div className="flex flex-1 items-center justify-center overflow-hidden rounded-lg bg-gray-900">
          {activeAppId ? null : (
            <span className="text-sm text-gray-600">Select an app</span>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
