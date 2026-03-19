export interface AppConfig {
  id: string;
  name: string;
  url: string;
  group: string;
}

export interface GroupConfig {
  id: string;
  name: string;
}

export interface NexusConfig {
  groups: GroupConfig[];
  apps: AppConfig[];
}
