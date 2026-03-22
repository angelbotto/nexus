import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { getVersion } from "@tauri-apps/api/app";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen: _isOpen, onClose }: SettingsPanelProps) {
  const [version, setVersion] = useState("");

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("unknown"));
  }, []);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: 0.15, ease: "easeOut" } }}
        exit={{ opacity: 0, transition: { duration: 0.1, ease: "easeIn" } }}
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />
      {/* Centered modal card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1, transition: { duration: 0.15, ease: "easeOut" } }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1, ease: "easeIn" } }}
        className="fixed left-1/2 top-1/2 z-50 w-[520px] max-h-[70vh] -translate-x-1/2 -translate-y-1/2 flex flex-col rounded-xl bg-[#1a1a22] border border-white/10 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Settings</h2>
          <button
            className="text-gray-500 hover:text-gray-300 transition-colors"
            onClick={onClose}
            aria-label="Close settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Appearance</h3>
            <p className="text-sm text-gray-600">Coming in a future update</p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Sidebar</h3>
            <p className="text-sm text-gray-600">Coming in a future update</p>
          </section>
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">About</h3>
            <p className="text-sm text-gray-400">Nexus v{version}</p>
            <a
              href="https://github.com/angelbotto/nexus"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
            >
              GitHub
            </a>
          </section>
        </div>
      </motion.div>
    </>
  );
}
