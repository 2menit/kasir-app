"use client";

import { useEffect } from "react";

/**
 * Registers the service worker (`/sw.js`) on mount. The SW enables the
 * Background Sync API so queued transactions can be flushed even if the
 * tab is closed. Registration is a no-op in dev when SW support is off.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
        });
        // Request a background sync registration. The SW's `sync` event
        // (tag: "flush-transactions") will fire when connectivity returns
        // — even after the tab is closed (Chrome/Edge only).
        const syncManager = (reg as unknown as {
          sync?: { register: (tag: string) => Promise<void> };
        }).sync;
        if (syncManager) {
          await syncManager.register("flush-transactions");
        }
      } catch (err) {
        // SW registration is best-effort; the app still works without it
        // via the useOfflineSync hook's `online` event listener fallback.
        console.warn("[sw] registration failed:", err);
      }
    };

    register();
  }, []);

  return null;
}
