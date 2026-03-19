import type { NexusConfig, GroupConfig, AppConfig } from "../types";
import { AppIcon } from "./AppIcon";

interface SidebarProps {
  config: NexusConfig;
  activeAppId: string | null;
  onSwitch: (id: string) => Promise<void>;
  onGroupToggle: (groupId: string) => void;
}

interface GroupBucket {
  group: GroupConfig | null;
  apps: AppConfig[];
}

function groupApps(config: NexusConfig): GroupBucket[] {
  const buckets: GroupBucket[] = [];
  const groupMap = new Map(config.groups.map((g) => [g.id, g]));
  const appsByGroup = new Map<string | null, AppConfig[]>();

  for (const app of config.apps) {
    const group = groupMap.has(app.group) ? app.group : null;
    const bucket = appsByGroup.get(group) ?? [];
    bucket.push(app);
    appsByGroup.set(group, bucket);
  }

  for (const group of config.groups) {
    const apps = appsByGroup.get(group.id);
    if (apps && apps.length > 0) {
      buckets.push({ group, apps });
    }
  }

  const ungrouped = appsByGroup.get(null);
  if (ungrouped && ungrouped.length > 0) {
    buckets.push({ group: null, apps: ungrouped });
  }

  return buckets;
}

export function Sidebar({
  config,
  activeAppId,
  onSwitch,
  onGroupToggle,
}: SidebarProps) {
  const buckets = groupApps(config);

  return (
    <aside className="flex h-full w-[220px] flex-shrink-0 flex-col bg-sidebar">
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {config.apps.length === 0 ? (
          <p className="px-2 py-2 text-sm text-gray-500">No apps configured</p>
        ) : (
          buckets.map((bucket, idx) => (
            <div key={bucket.group?.id ?? `other-${idx}`} className="mb-1">
              {bucket.group && (
                <button
                  className="flex w-full items-center justify-between px-2 py-1 text-left"
                  onClick={() => onGroupToggle(bucket.group!.id)}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                    {bucket.group.name}
                  </span>
                  <svg
                    className={`h-3 w-3 text-gray-500 transition-transform ${bucket.group.collapsed ? "-rotate-90" : ""}`}
                    viewBox="0 0 12 12"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M3 4.5L6 7.5L9 4.5" />
                  </svg>
                </button>
              )}
              {(!bucket.group || !bucket.group.collapsed) && (
                <ul className="space-y-0.5">
                  {bucket.apps.map((app) => {
                    const isActive = app.id === activeAppId;
                    return (
                      <li key={app.id}>
                        <button
                          className={`flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-white/10 text-white"
                              : "text-gray-400 hover:bg-white/5"
                          }`}
                          onClick={() => onSwitch(app.id)}
                        >
                          <AppIcon appUrl={app.url} appName={app.name} />
                          <span className="truncate">{app.name}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))
        )}
      </nav>
    </aside>
  );
}
