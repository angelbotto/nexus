use std::collections::{HashSet, VecDeque};

use crate::config::NexusConfig;

pub const LRU_POOL_SIZE: usize = 8;

pub struct AppState {
    pub config: NexusConfig,
    pub active_app_id: Option<String>,
    pub webviews_created: HashSet<String>,
    pub sidebar_visible: bool,
    pub lru_order: VecDeque<String>,
}

impl AppState {
    pub fn new(config: NexusConfig) -> Self {
        let sidebar_visible = !config.sidebar_collapsed;
        Self {
            config,
            active_app_id: None,
            webviews_created: HashSet::new(),
            sidebar_visible,
            lru_order: VecDeque::new(),
        }
    }
}
