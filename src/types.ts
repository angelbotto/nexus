export interface AppConfig {
  id: string;
  name: string;
  url: string;
  group: string;
}

export interface GroupConfig {
  id: string;
  name: string;
  collapsed: boolean;
}

export interface NexusConfig {
  groups: GroupConfig[];
  apps: AppConfig[];
  lastActiveAppId?: string | null;
  sidebarCollapsed: boolean;
  mutedAppIds: string[];
  dndEnabled: boolean;
  pinnedAppIds: string[];
  sidebarWidth: number;
}
