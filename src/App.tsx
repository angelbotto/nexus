import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NexusConfig } from "./types";

function App() {
  const [config, setConfig] = useState<NexusConfig | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    invoke<NexusConfig>("load_config")
      .then(setConfig)
      .catch((e: unknown) => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="p-4 text-red-600">
        <p>Failed to load config: {error}</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="p-4 text-gray-500">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <aside className="w-48 border-r border-gray-200 bg-white p-3">
        <h1 className="mb-4 text-sm font-semibold text-gray-900">Nexus</h1>
        <ul className="space-y-1">
          {config.apps.map((app) => (
            <li key={app.id}>
              <button
                className="w-full rounded px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => {
                  // Webview creation handled in future plans
                  console.log("Switch to:", app.id);
                }}
              >
                {app.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <main className="flex flex-1 items-center justify-center text-gray-400 text-sm">
        Select an app
      </main>
    </div>
  );
}

export default App;
