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
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0, transition: { duration: 0.2, ease: "easeOut" } }}
      exit={{ x: "100%", transition: { duration: 0.15, ease: "easeIn" } }}
      className="absolute right-0 top-0 h-full w-[350px] z-40 bg-[#111117] border-l border-white/10 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
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
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
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
  );
}
