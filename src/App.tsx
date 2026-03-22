import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import { useAppsConfig } from "./hooks/useAppsConfig";
import { useNotifications } from "./hooks/useNotifications";
import { useSidebarResize } from "./hooks/useSidebarResize";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { SettingsPanel } from "./components/SettingsPanel";
import { UpdateBanner } from "./components/UpdateBanner";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function App() {
  const {
    config,
    activeAppId,
    loadingAppId,
    sidebarVisible,
    badgeCounts,
    switchApp,
    addApp,
    removeApp,
    editApp,
    reorderApps,
    reorderGroups,
    toggleMute,
    pinApp,
    unpinApp,
    loading,
  } = useAppsConfig();

  const { mutedAppIds, dndEnabled, setDnd } = useNotifications(config);

  const [sidebarWidth, setSidebarWidth] = useState(() => config?.sidebarWidth ?? 200);
  const [iconOnly, setIconOnly] = useState(false);

  // Sync initial sidebar width from config on first load
  useEffect(() => {
    if (config?.sidebarWidth != null) {
      setSidebarWidth(config.sidebarWidth);
    }
  }, [config?.sidebarWidth]);

  const { width: currentSidebarWidth, iconOnly: currentIconOnly, isDragging, handleProps } = useSidebarResize({
    initialWidth: sidebarWidth,
    initialIconOnly: iconOnly,
    onWidthChange: (w, io) => {
      setSidebarWidth(w);
      setIconOnly(io);
      invoke("resize_active_webview", { sidebarVisible: true, sidebarWidth: w }).catch(() => {});
    },
    onWidthCommit: (w, _io) => {
      invoke("save_sidebar_width", { width: w }).catch(() => {});
    },
  });

  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [paletteInitialMode, setPaletteInitialMode] = useState<
    "search" | "action" | "add-form" | "edit-form" | undefined
  >(undefined);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Dim the active child webview while the palette or settings is open.
  useEffect(() => {
    invoke("set_active_webview_dimmed", { dimmed: isPaletteOpen || isSettingsOpen }).catch(() => {});
  }, [isPaletteOpen, isSettingsOpen]);

  useEffect(() => {
    function handleOpenPalette() {
      setIsPaletteOpen(true);
    }

    function handleOpenAddApp() {
      setIsPaletteOpen(true);
      setPaletteInitialMode("add-form");
    }

    function handleOpenSettings() {
      setIsSettingsOpen(true);
    }

    function handleToggleSettings() {
      setIsSettingsOpen((prev) => !prev);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      }
    }

    window.addEventListener("open-palette", handleOpenPalette);
    window.addEventListener("open-add-app", handleOpenAddApp);
    window.addEventListener("open-settings", handleOpenSettings);
    window.addEventListener("toggle-settings", handleToggleSettings);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("open-palette", handleOpenPalette);
      window.removeEventListener("open-add-app", handleOpenAddApp);
      window.removeEventListener("open-settings", handleOpenSettings);
      window.removeEventListener("toggle-settings", handleToggleSettings);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handlePaletteClose() {
    setIsPaletteOpen(false);
    setPaletteInitialMode(undefined);
    setEditingAppId(null);
  }

  function handleReload() {
    invoke("reload_active_webview").catch(() => {});
  }

  function handleToggleSidebar() {
    window.dispatchEvent(new CustomEvent("sidebar-toggle"));
  }

  function handleEditApp(appId: string) {
    setEditingAppId(appId);
    setIsPaletteOpen(true);
    setPaletteInitialMode("edit-form");
  }

  function handleReloadApp(appId: string) {
    invoke("reload_webview", { appId }).catch(() => {});
  }

  async function handleSwitchApp(id: string) {
    if (id === activeAppId) return;
    await switchApp(id);
    setIsSwitching(true);
    setTimeout(() => setIsSwitching(false), 100);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id || !config) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const groupIds = config.groups.map((g) => g.id);
    const isGroupDrag = groupIds.includes(activeIdStr);

    if (isGroupDrag) {
      const oldIndex = groupIds.indexOf(activeIdStr);
      const newIndex = groupIds.indexOf(overIdStr);
      if (oldIndex === -1 || newIndex === -1) return;
      const updatedGroups = arrayMove(config.groups, oldIndex, newIndex);
      reorderGroups(updatedGroups).catch(() => {});
    } else {
      // App drag
      const allAppIds = config.apps.map((a) => a.id);
      const oldIndex = allAppIds.indexOf(activeIdStr);

      if (oldIndex === -1) return;

      const overIsGroup = groupIds.includes(overIdStr);

      if (overIsGroup) {
        // Moving app to the start of a group
        const movedApp = { ...config.apps[oldIndex], group: overIdStr };
        const withoutApp = config.apps.filter((_, i) => i !== oldIndex);
        // Insert at the beginning of apps belonging to the target group
        const targetGroupStart = withoutApp.findIndex((a) => a.group === overIdStr);
        const insertAt = targetGroupStart === -1 ? withoutApp.length : targetGroupStart;
        const updatedApps = [
          ...withoutApp.slice(0, insertAt),
          movedApp,
          ...withoutApp.slice(insertAt),
        ];
        reorderApps(updatedApps).catch(() => {});
      } else {
        // Moving app to another app's position
        const newIndex = allAppIds.indexOf(overIdStr);
        if (newIndex === -1) return;

        const overApp = config.apps[newIndex];
        const movedApp = { ...config.apps[oldIndex], group: overApp.group };
        const withoutMoved = config.apps.filter((_, i) => i !== oldIndex);
        const adjustedNewIndex = withoutMoved.findIndex((a) => a.id === overIdStr);
        const updatedApps = [
          ...withoutMoved.slice(0, adjustedNewIndex),
          movedApp,
          ...withoutMoved.slice(adjustedNewIndex),
        ];
        reorderApps(updatedApps).catch(() => {});
      }
    }
  }

  function handleDragCancel() {
    setActiveId(null);
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

  const activeApp = activeId ? config.apps.find((a) => a.id === activeId) : null;
  const activeGroup = activeId ? config.groups.find((g) => g.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Top drag region — spans the gap above the webview (40px).
          Uses onMouseDown + startDragging() because data-tauri-drag-region
          doesn't work reliably with titleBarStyle Overlay. */}
      <div
        className="fixed top-0 left-0 right-0 h-10 z-30"
        onMouseDown={() => {
          getCurrentWindow().startDragging().catch(() => {});
        }}
      />
      <div className={`flex h-screen overflow-hidden bg-[#111117]${isDragging ? " select-none cursor-col-resize" : ""}`}>
        <AnimatePresence initial={false}>
          {sidebarVisible && (
            <motion.aside
              key="sidebar"
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1, transition: { duration: prefersReducedMotion ? 0 : 0.15, ease: "easeOut" } }}
              exit={{ x: "-100%", opacity: 0, transition: { duration: prefersReducedMotion ? 0 : 0.12, ease: "easeIn" } }}
              className="flex-shrink-0 h-full"
              style={{ width: currentIconOnly ? 48 : currentSidebarWidth }}
            >
              <Sidebar
                config={config}
                activeAppId={activeAppId}
                badgeCounts={badgeCounts}
                mutedAppIds={mutedAppIds}
                iconOnly={currentIconOnly}
                sidebarWidth={currentSidebarWidth}
                resizeHandleProps={handleProps}
                onToggleMute={toggleMute}
                switchApp={handleSwitchApp}
                removeApp={removeApp}
                editApp={handleEditApp}
                onReload={handleReloadApp}
                onPinApp={pinApp}
                onUnpinApp={unpinApp}
              />
            </motion.aside>
          )}
        </AnimatePresence>
        <main
          className="relative flex flex-1 items-center justify-center text-sm text-gray-600"
        >
          {!activeAppId && (
            <span className="text-gray-500">Select an app</span>
          )}
          {loadingAppId && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <svg
                className="h-8 w-8 animate-spin text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            </div>
          )}
          <AnimatePresence>
            {isSwitching && (
              <motion.div
                key="crossfade"
                className="pointer-events-none absolute inset-0 bg-[#111117]"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0, transition: { duration: prefersReducedMotion ? 0 : 0.08, ease: "easeOut" } }}
                exit={{ opacity: 0 }}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isSettingsOpen && (
              <SettingsPanel
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
              />
            )}
          </AnimatePresence>
        </main>

        <CommandPalette
          isOpen={isPaletteOpen}
          config={config}
          activeAppId={activeAppId}
          mutedAppIds={mutedAppIds}
          dndEnabled={dndEnabled}
          onToggleMute={toggleMute}
          onSetDnd={setDnd}
          onClose={handlePaletteClose}
          onSwitch={handleSwitchApp}
          onAdd={addApp}
          onRemove={removeApp}
          onEdit={editApp}
          onReload={handleReload}
          onToggleSidebar={handleToggleSidebar}
          initialMode={paletteInitialMode}
          editingAppId={editingAppId}
        />
      </div>

      <DragOverlay>
        {activeApp && (
          <div
            className="flex items-center gap-2.5 rounded px-2 py-2 text-sm text-white bg-white/10 w-[204px] opacity-50"
          >
            <img
              src={`https://www.google.com/s2/favicons?domain=${new URL(activeApp.url).hostname}&sz=32`}
              alt=""
              width={16}
              height={16}
              className="flex-shrink-0 rounded-sm"
            />
            <span className="truncate">{activeApp.name}</span>
          </div>
        )}
        {activeGroup && (
          <div className="flex items-center gap-1 px-2 py-1.5 opacity-50 w-[204px]">
            <svg
              className="h-3 w-3 flex-shrink-0 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              {activeGroup.name}
            </span>
          </div>
        )}
      </DragOverlay>
      <UpdateBanner />
    </DndContext>
  );
}

export default App;
