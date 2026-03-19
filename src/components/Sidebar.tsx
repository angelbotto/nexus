import { useState } from "react";
import type { NexusConfig } from "../types";

interface SidebarProps {
  config: NexusConfig;
  activeAppId: string | null;
  switchApp: (id: string) => Promise<void>;
}

function getFaviconUrl(appUrl: string): string {
  try {
    const url = new URL(appUrl);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
  } catch {
    return "";
  }
}

export function Sidebar({ config, activeAppId, switchApp }: SidebarProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(
    () => Object.fromEntries(config.groups.map((g) => [g.id, g.collapsed]))
  );

  function toggleGroup(groupId: string) {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  const appsWithoutGroup = config.apps.filter(
    (app) => !config.groups.some((g) => g.id === app.group)
  );

  return (
    <aside className="flex h-full w-[220px] flex-shrink-0 flex-col bg-[#111117]">
      <nav className="flex-1 overflow-y-auto px-2 pt-8 pb-2">
        {config.groups.map((group) => {
          const groupApps = config.apps.filter((app) => app.group === group.id);
          const isCollapsed = collapsedGroups[group.id] ?? false;

          return (
            <div key={group.id} className="mb-1">
              <button
                className="flex w-full items-center gap-1 px-2 py-1.5 text-left"
                onClick={() => toggleGroup(group.id)}
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

              {!isCollapsed && (
                <ul className="space-y-0.5">
                  {groupApps.map((app) => {
                    const isActive = app.id === activeAppId;
                    return (
                      <li key={app.id}>
                        <button
                          className={`flex w-full items-center gap-2.5 rounded px-2 py-2 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-gray-300 hover:bg-gray-800 hover:text-white"
                          }`}
                          onClick={() => switchApp(app.id)}
                        >
                          <img
                            src={getFaviconUrl(app.url)}
                            alt=""
                            width={16}
                            height={16}
                            className="flex-shrink-0 rounded-sm"
                          />
                          <span className="truncate">{app.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}

        {appsWithoutGroup.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {appsWithoutGroup.map((app) => {
              const isActive = app.id === activeAppId;
              return (
                <li key={app.id}>
                  <button
                    className={`flex w-full items-center gap-2.5 rounded px-2 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-white/10 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                    onClick={() => switchApp(app.id)}
                  >
                    <img
                      src={getFaviconUrl(app.url)}
                      alt=""
                      width={16}
                      height={16}
                      className="flex-shrink-0 rounded-sm"
                    />
                    <span className="truncate">{app.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {config.apps.length === 0 && (
          <p className="px-2 py-2 text-sm text-gray-500">No apps configured</p>
        )}
      </nav>
    </aside>
  );
}
