import { useAppsConfig } from "./hooks/useAppsConfig";
import { Sidebar } from "./components/Sidebar";

function App() {
  const { config, activeAppId, sidebarVisible, switchApp, loading } = useAppsConfig();

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
    <div className="flex h-screen overflow-hidden bg-[#111117]">
      {sidebarVisible && (
        <Sidebar config={config} activeAppId={activeAppId} switchApp={switchApp} />
      )}
      <main className="flex flex-1 items-center justify-center text-sm text-gray-600">
        {!activeAppId && (
          <span className="text-gray-500">Select an app</span>
        )}
      </main>
    </div>
  );
}

export default App;
