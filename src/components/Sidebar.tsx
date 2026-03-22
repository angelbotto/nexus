import { useState, useEffect, useRef } from "react";
import { useSortable, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Menu, MenuItem, PredefinedMenuItem } from "@tauri-apps/api/menu";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAnimate } from "motion/react";
import type { NexusConfig, AppConfig, GroupConfig } from "../types";

interface SidebarProps {
  config: NexusConfig;
  activeAppId: string | null;
  badgeCounts: Map<string, number | null>;
  mutedAppIds: Set<string>;
  iconOnly: boolean;
  sidebarWidth: number;
  resizeHandleProps: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  };
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
  badgeCount: number | null | undefined;
  isMuted: boolean;
  iconOnly: boolean;
  onToggleMute: (appId: string) => void;
  switchApp: (id: string) => Promise<void>;
  removeApp: (appId: string) => Promise<void>;
  editApp: (appId: string) => void;
  onReload: (appId: string) => void;
}

function BadgeCount({ count, isMuted }: { count: number | null; isMuted: boolean }) {
  const [scope, animate] = useAnimate();
  const prevCount = useRef(count);

  useEffect(() => {
    if (count !== prevCount.current && count !== null) {
      animate(scope.current, { scale: [1, 1.2, 1] }, { duration: 0.2 });
    }
    prevCount.current = count;
  }, [count, animate, scope]);

  if (count === null) {
    return <span className={`h-1.5 w-1.5 rounded-full bg-white ${isMuted ? "opacity-40" : "opacity-90"}`} />;
  }

  return (
    <span
      ref={scope}
      className={`min-w-[16px] rounded-full bg-white/20 px-1 text-center text-[10px] font-semibold tabular-nums leading-[16px] ${isMuted ? "opacity-40" : "opacity-90"}`}
    >
      {count > 99 ? "99+" : String(count)}
    </span>
  );
}

function SortableAppItem({
  app,
  isActive,
  badgeCount,
  isMuted,
  iconOnly,
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
        className={`group relative flex w-full items-center rounded text-left text-sm transition-colors ${
          iconOnly ? "justify-center px-1 py-2" : "gap-2.5 px-2 py-2"
        } ${
          isActive
            ? "bg-white/10 text-white"
            : "text-gray-300 hover:bg-gray-800 hover:text-white"
        }`}
        onClick={() => switchApp(app.id)}
        onContextMenu={handleContextMenu}
        {...attributes}
        {...listeners}
      >
        <div className="relative flex-shrink-0">
          <img
            src={getFaviconUrl(app.url)}
            alt={iconOnly ? app.name : ""}
            title={iconOnly ? app.name : undefined}
            width={16}
            height={16}
            className="rounded-sm"
          />
          {iconOnly && badgeCount !== undefined && !isActive && (
            <span className={`absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white/20 text-[8px] font-semibold ${isMuted ? "opacity-40" : "opacity-90"}`}>
              {badgeCount === null ? (
                <span className="h-1 w-1 rounded-full bg-white" />
              ) : (
                badgeCount > 9 ? "9+" : String(badgeCount)
              )}
            </span>
          )}
        </div>
        {!iconOnly && (
          <>
            <span className="truncate flex-1">{app.name}</span>
            <span className="ml-auto flex items-center gap-1 flex-shrink-0">
              {badgeCount !== undefined && !isActive && (
                <BadgeCount count={badgeCount} isMuted={isMuted} />
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                  <path d="M18.63 13A17.89 17.89 0 0 1 18 8"/>
                  <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/>
                  <path d="M18 8a6 6 0 0 0-9.33-5"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                </svg>
              )}
              </span>
            </span>
          </>
        )}
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
  badgeCounts,
  mutedAppIds,
  iconOnly,
  sidebarWidth,
  resizeHandleProps,
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
    <aside
      className="relative flex h-full flex-shrink-0 flex-col bg-[#111117]"
      style={{ width: iconOnly ? 48 : sidebarWidth }}
    >
      <div
        className="h-10 w-full flex-shrink-0"
        onMouseDown={() => {
          getCurrentWindow().startDragging().catch(() => {});
        }}
      />
      <nav className="flex-1 overflow-y-auto pb-2" style={{ paddingLeft: iconOnly ? 4 : 8, paddingRight: iconOnly ? 4 : 8 }}>
        {!iconOnly && (
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
                            badgeCount={badgeCounts.get(app.id)}
                            isMuted={mutedAppIds.has(app.id)}
                            iconOnly={false}
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
        )}

        {iconOnly ? (
          // Icon-only mode: show all apps as favicons only, no group headers
          <SortableContext
            items={config.apps.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-0.5">
              {config.apps.map((app) => (
                <SortableAppItem
                  key={app.id}
                  app={app}
                  isActive={app.id === activeAppId}
                  badgeCount={badgeCounts.get(app.id)}
                  isMuted={mutedAppIds.has(app.id)}
                  iconOnly={true}
                  onToggleMute={onToggleMute}
                  switchApp={switchApp}
                  removeApp={removeApp}
                  editApp={editApp}
                  onReload={onReload}
                />
              ))}
            </ul>
          </SortableContext>
        ) : (
          appsWithoutGroup.length > 0 && (
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
                    badgeCount={badgeCounts.get(app.id)}
                    isMuted={mutedAppIds.has(app.id)}
                    iconOnly={false}
                    onToggleMute={onToggleMute}
                    switchApp={switchApp}
                    removeApp={removeApp}
                    editApp={editApp}
                    onReload={onReload}
                  />
                ))}
              </ul>
            </SortableContext>
          )
        )}

        {config.apps.length === 0 && (
          <p className="px-2 py-2 text-sm text-gray-500">{iconOnly ? "" : "No apps configured"}</p>
        )}
      </nav>
      {!iconOnly && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-white/5">
          <div />
          <button
            className="text-gray-500 hover:text-gray-300 transition-colors"
            onClick={() => window.dispatchEvent(new CustomEvent("sidebar-toggle"))}
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
        </div>
      )}
      {/* Resize handle — absolute right edge, pointer capture-based */}
      <div
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize group"
        {...resizeHandleProps}
      >
        <div className="h-full w-px bg-white/0 group-hover:bg-white/10 transition-colors" />
      </div>
    </aside>
  );
}
