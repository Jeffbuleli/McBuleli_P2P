"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    /** Après un `next start` local, un SW peut servir d’anciennes navigations ; en `next dev` ça casse le runtime Webpack (chunks hors sync). */
    if (process.env.NODE_ENV === "development") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const r of regs) void r.unregister();
      });
      return;
    }

    void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
