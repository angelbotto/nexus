import { useState } from "react";

export function getFaviconUrl(appUrl: string): string {
  try {
    const url = new URL(appUrl);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
  } catch {
    return "";
  }
}

interface AppIconProps {
  appUrl: string;
  appName: string;
}

export function AppIcon({ appUrl, appName }: AppIconProps) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = getFaviconUrl(appUrl);

  if (failed || !faviconUrl) {
    return (
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] text-gray-300">
        {appName.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    <img
      src={faviconUrl}
      alt=""
      width={16}
      height={16}
      className="h-4 w-4 flex-shrink-0 rounded-sm"
      onError={() => setFailed(true)}
    />
  );
}
