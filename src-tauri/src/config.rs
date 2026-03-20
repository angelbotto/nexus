use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    pub group: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GroupConfig {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub collapsed: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NexusConfig {
    pub groups: Vec<GroupConfig>,
    pub apps: Vec<AppConfig>,
    #[serde(default)]
    pub last_active_app_id: Option<String>,
    #[serde(default)]
    pub sidebar_collapsed: bool,
}

pub fn config_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let mut path = dirs::home_dir().expect("cannot resolve home dir");
        path.push(".nexus");
        path.push("apps.json");
        path
    }
    #[cfg(target_os = "windows")]
    {
        let mut path = dirs::config_dir().expect("cannot resolve config dir");
        path.push("Nexus");
        path.push("apps.json");
        path
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let mut path = dirs::config_dir().expect("cannot resolve config dir");
        path.push("nexus");
        path.push("apps.json");
        path
    }
}

pub fn default_config() -> NexusConfig {
    NexusConfig {
        groups: vec![
            GroupConfig {
                id: "mis-productos".to_string(),
                name: "Mis Productos".to_string(),
                collapsed: false,
            },
            GroupConfig {
                id: "tools".to_string(),
                name: "Tools".to_string(),
                collapsed: false,
            },
        ],
        apps: vec![
            AppConfig {
                id: "plane".to_string(),
                name: "Plane".to_string(),
                url: "https://plane.botto.is".to_string(),
                group: "mis-productos".to_string(),
            },
            AppConfig {
                id: "linear".to_string(),
                name: "Linear".to_string(),
                url: "https://linear.app".to_string(),
                group: "tools".to_string(),
            },
            AppConfig {
                id: "gmail".to_string(),
                name: "Gmail".to_string(),
                url: "https://mail.google.com".to_string(),
                group: "tools".to_string(),
            },
            AppConfig {
                id: "github".to_string(),
                name: "GitHub".to_string(),
                url: "https://github.com".to_string(),
                group: "tools".to_string(),
            },
        ],
        last_active_app_id: None,
        sidebar_collapsed: false,
    }
}

pub fn load_or_create_config() -> NexusConfig {
    let path = config_path();
    if !path.exists() {
        let default = default_config();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(&default) {
            let _ = std::fs::write(&path, json);
        }
        return default;
    }
    let content = std::fs::read_to_string(&path).unwrap_or_default();
    serde_json::from_str(&content).unwrap_or_else(|_| default_config())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn config_in_tempdir(dir: &TempDir) -> PathBuf {
        dir.path().join("apps.json")
    }

    fn load_from_path(path: &PathBuf) -> NexusConfig {
        let content = fs::read_to_string(path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_else(|_| default_config())
    }

    #[test]
    fn test_nexus_config_json_round_trip() {
        let original = default_config();
        let json = serde_json::to_string_pretty(&original).expect("serialize failed");
        let restored: NexusConfig = serde_json::from_str(&json).expect("deserialize failed");
        assert_eq!(original, restored);
    }

    #[test]
    fn test_load_or_create_creates_default_when_missing() {
        let dir = TempDir::new().unwrap();
        let path = config_in_tempdir(&dir);

        // File does not exist yet
        assert!(!path.exists());

        // Write default config to path manually (simulating load_or_create behavior)
        let default = default_config();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        let json = serde_json::to_string_pretty(&default).unwrap();
        fs::write(&path, json).unwrap();

        // Now verify the file was created with valid content
        assert!(path.exists());
        let loaded = load_from_path(&path);
        assert_eq!(loaded, default);
    }

    #[test]
    fn test_load_or_create_reads_existing_valid_json() {
        let dir = TempDir::new().unwrap();
        let path = config_in_tempdir(&dir);

        let custom_config = NexusConfig {
            groups: vec![GroupConfig {
                id: "custom".to_string(),
                name: "Custom Group".to_string(),
                collapsed: false,
            }],
            apps: vec![AppConfig {
                id: "custom-app".to_string(),
                name: "Custom App".to_string(),
                url: "https://example.com".to_string(),
                group: "custom".to_string(),
            }],
            last_active_app_id: None,
            sidebar_collapsed: false,
        };

        let json = serde_json::to_string_pretty(&custom_config).unwrap();
        fs::write(&path, json).unwrap();

        let loaded = load_from_path(&path);
        assert_eq!(loaded, custom_config);
    }

    #[test]
    fn test_load_or_create_falls_back_to_default_on_corrupt_json() {
        let dir = TempDir::new().unwrap();
        let path = config_in_tempdir(&dir);

        // Write invalid JSON
        fs::write(&path, "{ this is not valid json!!!").unwrap();

        let content = fs::read_to_string(&path).unwrap_or_default();
        let result: NexusConfig =
            serde_json::from_str(&content).unwrap_or_else(|_| default_config());

        // Should fall back to default config
        assert_eq!(result, default_config());
    }

    #[test]
    fn test_default_config_contains_exactly_4_apps_in_2_groups() {
        let config = default_config();
        assert_eq!(config.apps.len(), 4, "should have exactly 4 default apps");
        assert_eq!(
            config.groups.len(),
            2,
            "should have exactly 2 default groups"
        );
    }

    #[test]
    fn test_plane_botto_is_in_mis_productos_group() {
        let config = default_config();
        let plane = config
            .apps
            .iter()
            .find(|a| a.url.contains("plane.botto.is"))
            .expect("plane.botto.is should be in default config");
        assert_eq!(
            plane.group, "mis-productos",
            "plane.botto.is should be in mis-productos group"
        );
    }

    #[test]
    fn test_apps_with_invalid_group_id_still_loads() {
        let dir = TempDir::new().unwrap();
        let path = config_in_tempdir(&dir);

        // Config with an app referencing a non-existent group
        let config_with_invalid_group = r#"{
            "groups": [
                { "id": "valid-group", "name": "Valid Group" }
            ],
            "apps": [
                { "id": "app1", "name": "App 1", "url": "https://app1.com", "group": "non-existent-group" }
            ]
        }"#;
        fs::write(&path, config_with_invalid_group).unwrap();

        // Should load successfully (group validation is UI-layer concern, not config loading)
        let content = fs::read_to_string(&path).unwrap_or_default();
        let result: Result<NexusConfig, _> = serde_json::from_str(&content);
        assert!(
            result.is_ok(),
            "config with invalid group id should still parse"
        );
        let loaded = result.unwrap();
        assert_eq!(loaded.apps.len(), 1);
        assert_eq!(loaded.apps[0].group, "non-existent-group");
    }

    #[test]
    fn test_default_config_app_ids() {
        let config = default_config();
        let ids: Vec<&str> = config.apps.iter().map(|a| a.id.as_str()).collect();
        assert!(ids.contains(&"plane"), "should have plane app");
        assert!(ids.contains(&"linear"), "should have linear app");
        assert!(ids.contains(&"gmail"), "should have gmail app");
        assert!(ids.contains(&"github"), "should have github app");
    }

    #[test]
    fn test_group_config_collapsed_defaults_to_false_when_missing() {
        // Old JSON without "collapsed" field — should deserialize with collapsed=false
        let json = r#"{"id": "tools", "name": "Tools"}"#;
        let group: GroupConfig = serde_json::from_str(json).expect("deserialize failed");
        assert_eq!(group.collapsed, false, "collapsed should default to false");
    }

    #[test]
    fn test_nexus_config_new_fields_default_when_missing() {
        // Old apps.json without lastActiveAppId/sidebarCollapsed — backward compatible
        let json = r#"{
            "groups": [{"id": "g1", "name": "G1"}],
            "apps": [{"id": "a1", "name": "A1", "url": "https://a1.com", "group": "g1"}]
        }"#;
        let config: NexusConfig = serde_json::from_str(json).expect("deserialize failed");
        assert_eq!(
            config.last_active_app_id, None,
            "lastActiveAppId should default to None"
        );
        assert_eq!(
            config.sidebar_collapsed, false,
            "sidebarCollapsed should default to false"
        );
    }

    #[test]
    fn test_nexus_config_new_fields_round_trip() {
        let config = NexusConfig {
            groups: vec![GroupConfig {
                id: "g1".to_string(),
                name: "G1".to_string(),
                collapsed: true,
            }],
            apps: vec![AppConfig {
                id: "a1".to_string(),
                name: "A1".to_string(),
                url: "https://a1.com".to_string(),
                group: "g1".to_string(),
            }],
            last_active_app_id: Some("a1".to_string()),
            sidebar_collapsed: true,
        };
        let json = serde_json::to_string_pretty(&config).expect("serialize failed");
        // Verify camelCase field names in JSON output
        assert!(
            json.contains("lastActiveAppId"),
            "JSON should use camelCase"
        );
        assert!(
            json.contains("sidebarCollapsed"),
            "JSON should use camelCase"
        );
        let restored: NexusConfig = serde_json::from_str(&json).expect("deserialize failed");
        assert_eq!(config, restored, "round-trip should preserve all fields");
    }

    #[test]
    fn test_backward_compat_old_apps_json_loads() {
        // Simulates a real old-format apps.json from Phase 1
        let old_json = r#"{
            "groups": [
                {"id": "mis-productos", "name": "Mis Productos"},
                {"id": "tools", "name": "Tools"}
            ],
            "apps": [
                {"id": "plane", "name": "Plane", "url": "https://plane.botto.is", "group": "mis-productos"},
                {"id": "gmail", "name": "Gmail", "url": "https://mail.google.com", "group": "tools"}
            ]
        }"#;
        let config: NexusConfig = serde_json::from_str(old_json).expect("old format should load");
        assert_eq!(config.groups.len(), 2);
        assert_eq!(config.apps.len(), 2);
        assert_eq!(config.sidebar_collapsed, false);
        assert_eq!(config.last_active_app_id, None);
        assert_eq!(config.groups[0].collapsed, false);
        assert_eq!(config.groups[1].collapsed, false);
    }
}
