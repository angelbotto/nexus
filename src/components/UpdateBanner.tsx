import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const update = await check();
        if (update?.available) {
          setVersion(update.version);
        }
      } catch {
        // Silent fail — no update manifest available in dev mode
      }
    })();
  }, []);

  if (!version || dismissed) {
    return null;
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      const update = await check();
      if (update?.available) {
        await update.downloadAndInstall();
        await relaunch();
      }
    } catch {
      // Silent fail
      setRestarting(false);
    }
  }

  function handleDismiss() {
    setDismissed(true);
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 h-8 bg-[#1a1a22] border-t border-white/5 flex items-center justify-between px-4 text-xs text-white/60 z-50">
      <span>Update available (v{version})</span>
      <div className="flex gap-2">
        <button
          className="text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
          onClick={handleRestart}
          disabled={restarting}
        >
          {restarting ? "Updating..." : "Restart"}
        </button>
        <button
          className="text-white/40 hover:text-white/60 transition-colors"
          onClick={handleDismiss}
        >
          x
        </button>
      </div>
    </div>
  );
}
