pub fn extract_base_domain(url: &str) -> String {
    let host = url
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .split('/')
        .next()
        .unwrap_or("");
    let parts: Vec<&str> = host.split('.').collect();
    if parts.len() >= 2 {
        format!("{}.{}", parts[parts.len() - 2], parts[parts.len() - 1])
    } else {
        host.to_string()
    }
}

pub fn is_subdomain_of(candidate: &str, base: &str) -> bool {
    candidate.ends_with(&format!(".{}", base))
}

pub fn is_oauth_provider(url: &str) -> bool {
    let oauth_domains = [
        "accounts.google.com",
        "login.microsoftonline.com",
        "auth0.com",
        "okta.com",
        "appleid.apple.com",
    ];
    let without_scheme = url
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let host = without_scheme.split('/').next().unwrap_or("");
    let path = without_scheme.get(host.len()..).unwrap_or("");

    for domain in &oauth_domains {
        if host == *domain || host.ends_with(&format!(".{}", domain)) {
            return true;
        }
    }
    // Special case: github.com/login/*
    if host == "github.com" && path.starts_with("/login") {
        return true;
    }
    false
}

#[cfg(target_os = "macos")]
pub fn make_store_id(app_id: &str) -> [u8; 16] {
    md5::compute(app_id.as_bytes()).0
}

#[allow(unused_variables, dead_code)]
pub fn platform_data_dir(app_id: &str) -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("Nexus")
            .join("webdata")
            .join(app_id)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        dirs::config_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .join("nexus")
            .join("webdata")
            .join(app_id)
    }
    #[cfg(target_os = "macos")]
    {
        std::path::PathBuf::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_base_domain_gmail() {
        assert_eq!(extract_base_domain("https://mail.google.com/inbox"), "google.com");
    }

    #[test]
    fn test_extract_base_domain_custom_tld() {
        assert_eq!(extract_base_domain("https://plane.botto.is/projects"), "botto.is");
    }

    #[test]
    fn test_extract_base_domain_two_part() {
        assert_eq!(extract_base_domain("https://linear.app/team"), "linear.app");
    }

    #[test]
    fn test_is_subdomain_of_true() {
        assert!(is_subdomain_of("mail.google.com", "google.com"));
    }

    #[test]
    fn test_is_subdomain_of_same_domain() {
        assert!(!is_subdomain_of("google.com", "google.com"));
    }

    #[test]
    fn test_is_subdomain_of_evil_domain() {
        assert!(!is_subdomain_of("evil-google.com", "google.com"));
    }

    #[test]
    fn test_is_oauth_provider_google() {
        assert!(is_oauth_provider("https://accounts.google.com/signin"));
    }

    #[test]
    fn test_is_oauth_provider_microsoft() {
        assert!(is_oauth_provider("https://login.microsoftonline.com/common"));
    }

    #[test]
    fn test_is_oauth_provider_github() {
        assert!(is_oauth_provider("https://github.com/login/oauth"));
    }

    #[test]
    fn test_is_oauth_provider_false() {
        assert!(!is_oauth_provider("https://linear.app/team"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_make_store_id_not_zeros() {
        let id = make_store_id("linear");
        assert_ne!(id, [0u8; 16]);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_make_store_id_deterministic() {
        assert_eq!(make_store_id("linear"), make_store_id("linear"));
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_make_store_id_unique_per_app() {
        assert_ne!(make_store_id("linear"), make_store_id("gmail"));
    }
}
