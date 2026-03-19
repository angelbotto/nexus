use std::collections::HashSet;

use crate::config::NexusConfig;

pub struct AppState {
    pub config: NexusConfig,
    pub active_app_id: Option<String>,
    pub webviews_created: HashSet<String>,
}

impl AppState {
    pub fn new(config: NexusConfig) -> Self {
        Self {
            config,
            active_app_id: None,
            webviews_created: HashSet::new(),
        }
    }
}
