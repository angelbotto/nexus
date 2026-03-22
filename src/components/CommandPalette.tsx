import { useState, useEffect, useRef } from "react";
import Fuse from "fuse.js";
import { AnimatePresence, motion } from "motion/react";
import type { NexusConfig } from "../types";

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type PaletteMode = "search" | "action" | "add-form" | "edit-form";

interface Action {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface Props {
  isOpen: boolean;
  config: NexusConfig | null;
  activeAppId: string | null;
  mutedAppIds: Set<string>;
  dndEnabled: boolean;
  onToggleMute: (appId: string) => void;
  onSetDnd: (enabled: boolean) => void;
  onClose: () => void;
  onSwitch: (id: string) => Promise<void>;
  onAdd: (name: string, url: string) => Promise<void>;
  onRemove: (appId: string) => Promise<void>;
  onEdit: (appId: string, name: string, url: string) => Promise<void>;
  onReload: () => void;
  onToggleSidebar: () => void;
  initialMode?: PaletteMode;
  editingAppId?: string | null;
}

const STATIC_ACTIONS: Action[] = [
  { id: "add-app", label: "Add new app" },
  { id: "remove-app", label: "Remove current app" },
  { id: "reload-page", label: "Reload page" },
  { id: "toggle-sidebar", label: "Toggle sidebar" },
];

export function CommandPalette({
  isOpen,
  config,
  activeAppId,
  mutedAppIds,
  dndEnabled,
  onToggleMute,
  onSetDnd,
  onClose,
  onSwitch,
  onAdd,
  onRemove,
  onEdit,
  onReload,
  onToggleSidebar,
  initialMode,
  editingAppId: editingAppIdProp,
}: Props) {
  const [mode, setMode] = useState<PaletteMode>("search");
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Add-form / edit-form state
  const [formUrl, setFormUrl] = useState("");
  const [formName, setFormName] = useState("");
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const urlRef = useRef<HTMLInputElement>(null);

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
      const m = initialMode ?? "search";
      setMode(m);
      setQuery("");
      setSelectedIndex(0);
      setFormUrl("");
      setFormName("");

      if (m === "edit-form" && editingAppIdProp) {
        setEditingAppId(editingAppIdProp);
        const app = config?.apps.find((a) => a.id === editingAppIdProp);
        if (app) {
          setFormUrl(app.url);
          setFormName(app.name);
        }
      } else {
        setEditingAppId(null);
      }

      // Focus the right element
      if (m === "add-form" || m === "edit-form") {
        setTimeout(() => urlRef.current?.focus(), 10);
      } else {
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    }
  }, [isOpen, initialMode, editingAppIdProp, config]);

  // Derive mode from query prefix
  useEffect(() => {
    if (mode === "add-form" || mode === "edit-form") return;
    if (query.startsWith(">")) {
      setMode("action");
    } else {
      setMode("search");
    }
    setSelectedIndex(0);
  }, [query, mode]);

  // Fuzzy search results
  const apps = config?.apps ?? [];
  const fuse = new Fuse(apps, { keys: ["name"], threshold: 0.4 });
  const searchResults = query === "" ? apps : fuse.search(query).map((r) => r.item);

  // Build dynamic actions (static + DND + per-app mute)
  const dndAction: Action = {
    id: "toggle-dnd",
    label: "Toggle Do Not Disturb",
    description: `Currently: ${dndEnabled ? "ON" : "OFF"}`,
  };

  const muteActions: Action[] = (config?.apps ?? []).map((app) => {
    const isMuted = mutedAppIds.has(app.id);
    return {
      id: `mute-${app.id}`,
      label: isMuted ? `Unmute ${app.name} notifications` : `Mute ${app.name} notifications`,
    };
  });

  const ALL_ACTIONS: Action[] = [...STATIC_ACTIONS, dndAction, ...muteActions];

  // Action filtering
  const actionQuery = query.startsWith(">") ? query.slice(1).trim() : "";
  const filteredActions = ALL_ACTIONS.filter((a) =>
    actionQuery === "" ? true : a.label.toLowerCase().includes(actionQuery.toLowerCase())
  ).map((a) => ({
    ...a,
    disabled: a.id === "remove-app" && !activeAppId,
  }));

  function handleKeyDown(e: React.KeyboardEvent) {
    if (mode === "add-form" || mode === "edit-form") {
      if (e.key === "Escape") {
        setMode("search");
        setQuery("");
        setTimeout(() => inputRef.current?.focus(), 10);
      }
      return;
    }

    const listLength = mode === "search" ? searchResults.length : filteredActions.length;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, listLength - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (mode === "search") {
        const item = searchResults[selectedIndex];
        if (item) {
          onSwitch(item.id).then(() => onClose());
        }
      } else if (mode === "action") {
        const action = filteredActions[selectedIndex];
        if (action && !action.disabled) {
          handleAction(action.id);
        }
      }
    } else if (e.key === "Tab" && mode === "search") {
      const item = searchResults[selectedIndex];
      if (item) {
        e.preventDefault();
        setQuery(item.name);
      }
    }
  }

  function handleAction(actionId: string) {
    if (actionId === "toggle-dnd") {
      onSetDnd(!dndEnabled);
      onClose();
      return;
    }
    if (actionId.startsWith("mute-")) {
      const appId = actionId.slice(5);
      onToggleMute(appId);
      onClose();
      return;
    }
    switch (actionId) {
      case "add-app":
        setMode("add-form");
        setFormUrl("");
        setFormName("");
        setTimeout(() => urlRef.current?.focus(), 10);
        break;
      case "remove-app":
        if (activeAppId) {
          onRemove(activeAppId).then(() => onClose());
        }
        break;
      case "reload-page":
        onReload();
        onClose();
        break;
      case "toggle-sidebar":
        onToggleSidebar();
        onClose();
        break;
    }
  }

  function handleFormKeyDown(e: React.KeyboardEvent, field: "url" | "name") {
    if (e.key === "Escape") {
      setMode("search");
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 10);
    } else if (e.key === "Enter") {
      if (field === "url") {
        // Move focus to name field
        (e.currentTarget.closest("form")?.elements.namedItem("name") as HTMLInputElement | null)?.focus();
      } else {
        e.preventDefault();
        handleFormSubmit();
      }
    }
  }

  function handleFormSubmit() {
    if (!formUrl.trim() || !formName.trim()) return;
    if (mode === "edit-form" && editingAppId) {
      onEdit(editingAppId, formName.trim(), formUrl.trim()).then(() => onClose());
    } else {
      onAdd(formName.trim(), formUrl.trim()).then(() => onClose());
    }
  }

  function getFaviconUrl(url: string) {
    try {
      const parsed = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=32`;
    } catch {
      return undefined;
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
    <motion.div
      key="palette-backdrop"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(0,0,0,0.6)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: prefersReducedMotion ? 0 : 0.12, ease: "easeOut" } }}
      exit={{ opacity: 0, transition: { duration: prefersReducedMotion ? 0 : 0.08, ease: "easeIn" } }}
      onClick={onClose}
    >
      <motion.div
        key="palette-panel"
        className="w-[560px] rounded-xl bg-[#111117] shadow-2xl ring-1 ring-white/10"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: { duration: prefersReducedMotion ? 0 : 0.12, ease: "easeOut" } }}
        exit={{ scale: 0.95, opacity: 0, transition: { duration: prefersReducedMotion ? 0 : 0.08, ease: "easeIn" } }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search / Action input */}
        {mode !== "add-form" && mode !== "edit-form" && (
          <input
            ref={inputRef}
            className="w-full bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500"
            placeholder={mode === "action" ? "> type an action..." : "Search apps..."}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        )}

        {/* Add / Edit form */}
        {(mode === "add-form" || mode === "edit-form") && (
          <form
            className="flex flex-col gap-2 px-4 py-3"
            onSubmit={(e) => { e.preventDefault(); handleFormSubmit(); }}
          >
            <input
              ref={urlRef}
              name="url"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500 border-b border-white/10 pb-2"
              placeholder="URL (e.g. https://linear.app)"
              value={formUrl}
              onChange={(e) => setFormUrl(e.target.value)}
              onKeyDown={(e) => handleFormKeyDown(e, "url")}
            />
            <input
              name="name"
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-gray-500"
              placeholder="Name (e.g. Linear)"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              onKeyDown={(e) => handleFormKeyDown(e, "name")}
            />
            <p className="text-xs text-gray-600">Press Enter to {mode === "edit-form" ? "save" : "add"} · Escape to cancel</p>
          </form>
        )}

        {/* Divider */}
        {(mode === "search" && searchResults.length > 0) ||
        (mode === "action" && filteredActions.length > 0) ? (
          <div className="border-t border-white/5" />
        ) : null}

        {/* Search results + quick actions */}
        {mode === "search" && (
          <ul className="max-h-[300px] overflow-y-auto py-1">
            {searchResults.map((app, i) => (
              <li
                key={app.id}
                className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  i === selectedIndex ? "bg-white/10 text-white" : "text-gray-300 hover:bg-white/5"
                }`}
                onClick={() => { onSwitch(app.id).then(() => onClose()); }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <img
                  src={getFaviconUrl(app.url)}
                  className="h-4 w-4 rounded-sm object-contain"
                  alt=""
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <span>{app.name}</span>
                {app.id === activeAppId && (
                  <span className="ml-auto text-xs text-gray-600">active</span>
                )}
              </li>
            ))}
            {searchResults.length === 0 && query !== "" && (
              <li className="px-4 py-3 text-sm text-gray-600">No apps match "{query}"</li>
            )}
            {/* Quick actions always visible at bottom of search results */}
            <li className="border-t border-white/5 mt-1" />
            <li
              className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition-colors ${
                selectedIndex === searchResults.length ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
              }`}
              onClick={() => { setMode("add-form"); setSelectedIndex(0); }}
              onMouseEnter={() => setSelectedIndex(searchResults.length)}
            >
              <span className="text-gray-500">+</span>
              <span>Add new app</span>
            </li>
            {activeAppId && (
              <li
                className={`flex cursor-pointer items-center gap-3 px-4 py-2 text-sm transition-colors ${
                  selectedIndex === searchResults.length + 1 ? "bg-white/10 text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
                onClick={() => { onRemove(activeAppId).then(() => onClose()); }}
                onMouseEnter={() => setSelectedIndex(searchResults.length + 1)}
              >
                <span className="text-gray-500">×</span>
                <span>Remove {config?.apps.find(a => a.id === activeAppId)?.name ?? "current app"}</span>
              </li>
            )}
          </ul>
        )}

        {/* Action list */}
        {mode === "action" && (
          <ul className="max-h-[300px] overflow-y-auto py-1">
            {filteredActions.map((action, i) => (
              <li
                key={action.id}
                className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm transition-colors ${
                  action.disabled
                    ? "cursor-default text-gray-600"
                    : i === selectedIndex
                    ? "bg-white/10 text-white"
                    : "text-gray-300 hover:bg-white/5"
                }`}
                onClick={() => { if (!action.disabled) handleAction(action.id); }}
                onMouseEnter={() => { if (!action.disabled) setSelectedIndex(i); }}
              >
                <span>{action.label}</span>
                {action.description && (
                  <span className="text-xs text-gray-500">{action.description}</span>
                )}
              </li>
            ))}
            {filteredActions.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-600">No actions match</li>
            )}
          </ul>
        )}
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  );
}
