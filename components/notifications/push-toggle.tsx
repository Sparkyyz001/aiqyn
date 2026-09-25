"use client";

import { useEffect, useState, useTransition } from "react";
import { BellRing, BellOff, Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/lib/actions/push";
import { cn } from "@/lib/utils";

type L = { title: string; sub: string; on: string; enable: string; disable: string; test: string; testSent: string; denied: string; ios: string; unsupported: string; enabled: string };
type State = "loading" | "unsupported" | "ios" | "denied" | "off" | "on";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

// Push-уведомления на телефон: включить/выключить для этого устройства и проверить.
// iPhone: push работает только у сайта, добавленного на экран «Домой» (iOS 16.4+) — подсказываем.
export function PushToggle({ l, variant = "card" }: { l: L; variant?: "card" | "banner" }) {
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    (async () => {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !KEY) return setState(ios && !standalone ? "ios" : "unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  const enable = () =>
    start(async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
        const reg = await navigator.serviceWorker.ready;
        const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(KEY) }));
        const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
        const res = await savePushSubscription(json, navigator.userAgent);
        if (!res.ok) throw new Error("save");
        setState("on");
        toast.success(l.enabled);
      } catch {
        toast.error(l.unsupported);
      }
    });
  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    });
  const test = () =>
    start(async () => {
      await sendTestPush();
      toast.success(l.testSent);
    });

  if (variant === "banner" && state !== "off" && state !== "ios") return null;
  if (state === "loading") return null;

  return (
    <div className={cn("flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center", state === "on" ? "border-[color:var(--ok)]/40 bg-[color:var(--ok)]/[0.06]" : "border-primary/25 bg-primary/[0.05]")}>
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", state === "on" ? "bg-[color:var(--ok)]/15 text-[color:var(--ok)]" : "bg-primary/12 text-primary")}>
        {state === "on" ? <BellRing className="size-5" /> : state === "ios" ? <Smartphone className="size-5" /> : <BellOff className="size-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{state === "on" ? l.on : l.title}</div>
        <p className="text-sm text-muted-foreground text-pretty">
          {state === "ios" ? l.ios : state === "denied" ? l.denied : state === "unsupported" ? l.unsupported : l.sub}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {state === "off" && (
          <Button onClick={enable} disabled={pending} className="btn-shine">
            {pending ? <Loader2 className="animate-spin" /> : <BellRing />} {l.enable}
          </Button>
        )}
        {state === "on" && (
          <>
            <Button variant="outline" onClick={test} disabled={pending}>
              {l.test}
            </Button>
            <Button variant="ghost" onClick={disable} disabled={pending}>
              {l.disable}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
