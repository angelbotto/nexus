import { useState } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { NexusConfig, AppConfig, GroupConfig } from "../types";

interface SidebarProps {
  config: NexusConfig;
  activeAppId: string | null;
  badgeAppIds: Set<string>;
  mutedAppIds: Set<string>;
  onToggleMute: (appId: string) => void;
  switchApp: (id: string) => Promise<void>;
  removeApp: (appId: string) => Promise<void>;
  editApp: (appId: string) => void;
  onReload: (appId: string) => void;
}

function getFaviconUrl(appUrl: string): string {
  try {
    const url = new URL(appUrl);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
  } catch {
    return "";
  }
}

interface SortableAppItemProps {
  app: AppConfig;
  isActive: boolean;
  hasBadge: boolean;
  isMuted: boolean;
  onToggleMute: (appId: string) => void;
  switchApp: (id: string) => Promise<void>;
  removeApp: (appId: string) => Promise<void>;
  editApp: (appId: string) => void;
  onReload: (appId: string) => void;
}

function SortableAppItem({
  app,
  isActive,
  hasBadge,
  isMuted,
  onToggleMute,
  switchApp,
  removeApp,
  editApp,
  onReload,
}: SortableAppItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  async function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    const appId = app.id;
    const menu = await Menu.new({
      items: [
        await MenuItem.new({
          text: isMuted ? "Unmute notifications" : "Mute notifications",
          action: () => onToggleMute(appId),
        }),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await MenuItem.new({ text: "Open", action: () => switchApp(appId) }),
        await MenuItem.new({ text: "Reload", action: () => onReload(appId) }),
        await PredefinedMenuItem.new({ item: "Separator" }),
        await MenuItem.new({ text: "Edit...", action: () => editApp(appId) }),
        await MenuItem.new({ text: "Remove", action: () => removeApp(appId) }),
      ],
    });
    await menu.popup();
  }

  return (
    <li ref={setNodeRef} style={style}>
      {isOver && !isDragging && (
        <div className="mx-2 h-px bg-white/30" />
      )}
      <button
        className={`group flex w-full items-center gap-2.5 rounded px-2 py-2 text-left text-sm transition-colors ${
          isActive
            ? "bg-white/10 text-white"
            : "text-gray-300 hover:bg-gray-800 hover:text-white"
        }`}
        onClick={() => switchApp(app.id)}
        onContextMenu={handleContextMenu}
        {...attributes}
        {...listeners}
      >
        <img
          src={getFaviconUrl(app.url)}
          alt=""
          width={16}
          height={16}
          className="flex-shrink-0 rounded-sm"
        />
        <span className="truncate flex-1">{app.name}</span>
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          {hasBadge && !isActive && !isMuted && (
            <span className="h-1.5 w-1.5 rounded-full bg-white opacity-90" />
          )}
          {hasBadge && !isActive && isMuted && (
            <span className="h-1.5 w-1.5 rounded-full bg-white/40" />
          )}
          <span
            className={`text-gray-500 transition-opacity cursor-pointer hover:text-gray-300 ${
              isMuted ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            }`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onToggleMute(app.id); }}
            title={isMuted ? "Unmute notifications" : "Mute notifications"}
            role="button"
            aria-label={isMuted ? "Unmute notifications" : "Mute notifications"}
          >
          {isMuted ? (
            // Bell-off icon (16x16)
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              <path d="M18.63 13A17.89 17.89 0 0 1 18 8"/>
              <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/>
              <path d="M18 8a6 6 0 0 0-9.33-5"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          ) : (
            // Bell icon (16x16)
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          )}
          </span>
        </span>
      </button>
    </li>
  );
}

interface SortableGroupHeaderProps {
  group: GroupConfig;
  isCollapsed: boolean;
  onToggle: (groupId: string) => void;
}

function SortableGroupHeader({ group, isCollapsed, onToggle }: SortableGroupHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        className="flex w-full items-center gap-1 px-2 py-1.5 text-left"
        onClick={() => onToggle(group.id)}
        {...attributes}
        {...listeners}
      >
        <svg
          className={`h-3 w-3 flex-shrink-0 text-gray-500 transition-transform ${
            isCollapsed ? "-rotate-90" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          {group.name}
        </span>
      </button>
    </div>
  );
}

export function Sidebar({
  config,
  activeAppId,
  badgeAppIds,
  mutedAppIds,
  onToggleMute,
  switchApp,
  removeApp,
  editApp,
  onReload,
}: SidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(config.groups.map((g) => [g.id, g.collapsed]))
  );

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  const appsWithoutGroup = config.apps.filter(
    (app) => !config.groups.some((g) => g.id === app.group)
  );

  const groupIds = config.groups.map((g) => g.id);

  return (
    <aside className="flex h-full w-[220px] flex-shrink-0 flex-col bg-[#111117]">
      <div
        className="h-10 w-full flex-shrink-0"
        onMouseDown={() => {
          getCurrentWindow().startDragging().catch(() => {});
        }}
      />
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
          {config.groups.map((group) => {
            const groupApps = config.apps.filter((app) => app.group === group.id);
            const isCollapsed = collapsedGroups[group.id] ?? false;
            const appIds = groupApps.map((a) => a.id);

            return (
              <div key={group.id} className="mb-1">
                <SortableGroupHeader
                  group={group}
                  isCollapsed={isCollapsed}
                  onToggle={toggleGroup}
                />

                {!isCollapsed && (
                  <SortableContext items={appIds} strategy={verticalListSortingStrategy}>
                    <ul className="space-y-0.5">
                      {groupApps.map((app) => (
                        <SortableAppItem
                          key={app.id}
                          app={app}
                          isActive={app.id === activeAppId}
                          hasBadge={badgeAppIds.has(app.id)}
                          isMuted={mutedAppIds.has(app.id)}
                          onToggleMute={onToggleMute}
                          switchApp={switchApp}
                          removeApp={removeApp}
                          editApp={editApp}
                          onReload={onReload}
                        />
                      ))}
                    </ul>
                  </SortableContext>
                )}
              </div>
            );
          })}
        </SortableContext>

        {appsWithoutGroup.length > 0 && (
          <SortableContext
            items={appsWithoutGroup.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="mt-1 space-y-0.5">
              {appsWithoutGroup.map((app) => (
                <SortableAppItem
                  key={app.id}
                  app={app}
                  isActive={app.id === activeAppId}
                  hasBadge={badgeAppIds.has(app.id)}
                  isMuted={mutedAppIds.has(app.id)}
                  onToggleMute={onToggleMute}
                  switchApp={switchApp}
                  removeApp={removeApp}
                  editApp={editApp}
                  onReload={onReload}
                />
              ))}
            </ul>
          </SortableContext>
        )}

        {config.apps.length === 0 && (
          <p className="px-2 py-2 text-sm text-gray-500">No apps configured</p>
        )}
      </nav>
    </aside>
  );
}
