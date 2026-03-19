import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useAppsConfig } from "./hooks/useAppsConfig";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";

function App() {
  const {
    config,
    activeAppId,
    sidebarVisible,
    switchApp,
    addApp,
    removeApp,
    editApp,
    loading,
  } = useAppsConfig();

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [paletteInitialMode, setPaletteInitialMode] = useState<
    "search" | "action" | "add-form" | "edit-form" | undefined
  >(undefined);

  useEffect(() => {
    function handleOpenPalette() {
      setIsPaletteOpen(true);
    }

    function handleOpenAddApp() {
      setIsPaletteOpen(true);
      setPaletteInitialMode("add-form");
    }

    window.addEventListener("open-palette", handleOpenPalette);
    window.addEventListener("open-add-app", handleOpenAddApp);

    return () => {
      window.removeEventListener("open-palette", handleOpenPalette);
      window.removeEventListener("open-add-app", handleOpenAddApp);
    };
  }, []);

  function handlePaletteClose() {
    setIsPaletteOpen(false);
    setPaletteInitialMode(undefined);
  }

  function handleReload() {
    invoke("reload_active_webview").catch(() => {});
  }

  function handleToggleSidebar() {
    window.dispatchEvent(new CustomEvent("sidebar-toggle"));
  }

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

  return (
    <div className="flex h-screen overflow-hidden bg-[#111117]">
      {sidebarVisible && (
        <Sidebar config={config} activeAppId={activeAppId} switchApp={switchApp} />
      )}
      <main className="flex flex-1 items-center justify-center text-sm text-gray-600">
        {!activeAppId && (
          <span className="text-gray-500">Select an app</span>
        )}
      </main>

      <CommandPalette
        isOpen={isPaletteOpen}
        config={config}
        activeAppId={activeAppId}
        onClose={handlePaletteClose}
        onSwitch={switchApp}
        onAdd={addApp}
        onRemove={removeApp}
        onEdit={editApp}
        onReload={handleReload}
        onToggleSidebar={handleToggleSidebar}
        initialMode={paletteInitialMode}
      />
    </div>
  );
}

export default App;
