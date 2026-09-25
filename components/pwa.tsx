"use client";

import { useEffect } from "react";

// Регистрация сервис-воркера (офлайн-страница) — только в собранной версии сайта
export function Pwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
