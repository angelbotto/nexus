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
  return (
    <aside className="flex h-full w-[220px] flex-shrink-0 flex-col bg-gray-900">
      <div className="px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Nexus
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {config.apps.length === 0 ? (
          <p className="px-2 py-2 text-sm text-gray-500">No apps configured</p>
        ) : (
          <ul className="space-y-0.5">
            {config.apps.map((app) => {
              const isActive = app.id === activeAppId;
              return (
                <li key={app.id}>
                  <button
                    className={`flex w-full items-center gap-2.5 rounded px-2 py-2 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-gray-700 text-white"
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
      </nav>
    </aside>
  );
}
