import { useAppsConfig } from "./hooks/useAppsConfig";
import { Sidebar } from "./components/Sidebar";

function App() {
  const { config, activeAppId, switchApp, loading } = useAppsConfig();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-400">
        Loading...
      </div>
    );
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-500">
        Failed to load config
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar config={config} activeAppId={activeAppId} switchApp={switchApp} />
      <main className="flex flex-1 items-center justify-center bg-gray-950 text-sm text-gray-600">
        {activeAppId ? null : "Select an app"}
      </main>
    </div>
  );
}

export default App;
