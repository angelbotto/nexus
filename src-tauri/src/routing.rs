pub fn extract_base_domain(url: &str) -> String {
    todo!()
}

pub fn is_subdomain_of(candidate: &str, base: &str) -> bool {
    todo!()
}

pub fn is_oauth_provider(url: &str) -> bool {
    todo!()
}

pub fn make_store_id(app_id: &str) -> [u8; 16] {
    todo!()
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

    #[test]
    fn test_make_store_id_not_zeros() {
        let id = make_store_id("linear");
        assert_ne!(id, [0u8; 16]);
    }

    #[test]
    fn test_make_store_id_deterministic() {
        assert_eq!(make_store_id("linear"), make_store_id("linear"));
    }

    #[test]
    fn test_make_store_id_unique_per_app() {
        assert_ne!(make_store_id("linear"), make_store_id("gmail"));
    }
}
