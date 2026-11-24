"use client";
import Script from "next/script";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { miniAppBackTarget } from "../lib/telegramMiniApp.mjs";
type Insets = { top?: number; bottom?: number; left?: number; right?: number };
type TelegramApp = {
  initData: string;
  version?: string;
  viewportStableHeight?: number;
  safeAreaInset?: Insets;
  contentSafeAreaInset?: Insets;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast?: (version: string) => boolean;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  onEvent?: (name: string, callback: () => void) => void;
  offEvent?: (name: string, callback: () => void) => void;
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (fn: () => void) => void;
    offClick: (fn: () => void) => void;
  };
  HapticFeedback?: { selectionChanged: () => void };
  openTelegramLink?: (url: string) => void;
};
declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramApp };
  }
}
type TelegramContext = {
  app: TelegramApp | null;
  status: "loading" | "browser" | "ready" | "error";
};
const Context = createContext<TelegramContext>({
  app: null,
  status: "loading",
});
const watch = (fn: () => void) => {
  window.addEventListener("hashchange", fn);
  window.addEventListener("popstate", fn);
  return () => {
    window.removeEventListener("hashchange", fn);
    window.removeEventListener("popstate", fn);
  };
};
const launchSnapshot = () => {
  try {
    return (
      !!window.Telegram?.WebApp?.initData ||
      /(?:^|[&#])tgWebApp(?:Data|Platform)=/.test(location.hash) ||
      sessionStorage.getItem("jup-telegram") === "1"
    );
  } catch {
    return !!window.Telegram?.WebApp?.initData;
  }
};
const serverSnapshot = () => false;
const bound = (n: unknown, max = 200) =>
  typeof n === "number" && Number.isFinite(n)
    ? Math.max(0, Math.min(max, n))
    : 0;
export function TelegramProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname().replace(/^\/findbuddy(?=\/|$)/, "") || "/";
  const router = useRouter();
  const launched = useSyncExternalStore(watch, launchSnapshot, serverSnapshot);
  const load = pathname === "/telegram" || launched;
  const [state, setState] = useState<TelegramContext>({
    app: null,
    status: "loading",
  });
  const cleanup = useRef<(() => void) | null>(null);
  const onReady = useCallback(() => {
    const app = window.Telegram?.WebApp;
    if (!app?.initData) {
      setState({ app: null, status: "browser" });
      return;
    }
    cleanup.current?.();
    const html = document.documentElement;
    const sync = () => {
      html.dataset.telegram = "true";
      for (const edge of ["top", "bottom", "left", "right"] as const)
        html.style.setProperty(
          `--tg-safe-${edge}`,
          `${bound(app.safeAreaInset?.[edge]) + bound(app.contentSafeAreaInset?.[edge])}px`,
        );
      if (app.viewportStableHeight)
        html.style.setProperty(
          "--tg-viewport-height",
          `${bound(app.viewportStableHeight, 10000)}px`,
        );
    };
    try {
      sessionStorage.setItem("jup-telegram", "1");
    } catch {}
    app.ready();
    app.expand();
    try {
      app.setHeaderColor?.("#f7f8fc");
      app.setBackgroundColor?.("#f7f8fc");
      if (app.isVersionAtLeast?.("7.10")) app.setBottomBarColor?.("#ffffff");
    } catch {}
    sync();
    const events = [
      "viewportChanged",
      "safeAreaChanged",
      "contentSafeAreaChanged",
    ];
    events.forEach((event) => app.onEvent?.(event, sync));
    const haptic = (event: MouseEvent) => {
      const button =
        event.target instanceof Element
          ? event.target.closest<HTMLButtonElement>("button.primary")
          : null;
      if (button && !button.disabled)
        try {
          app.HapticFeedback?.selectionChanged();
        } catch {}
    };
    document.addEventListener("click", haptic);
    cleanup.current = () => {
      events.forEach((event) => app.offEvent?.(event, sync));
      document.removeEventListener("click", haptic);
      delete html.dataset.telegram;
      for (const edge of ["top", "bottom", "left", "right"])
        html.style.removeProperty(`--tg-safe-${edge}`);
      html.style.removeProperty("--tg-viewport-height");
    };
    setState({ app, status: "ready" });
  }, []);
  useEffect(() => {
    if (!load || state.status !== "loading") return;
    const timer = window.setTimeout(
      () => setState({ app: null, status: "error" }),
      10000,
    );
    return () => window.clearTimeout(timer);
  }, [load, state.status]);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => {
    const app = state.app;
    if (!app) return;
    const sync = () => {
      const home =
        ["/teacher", "/student", "/business", "/admin"].includes(pathname) &&
        ["", "#overview", "#account", "#queue"].includes(location.hash);
      if (document.querySelector("dialog[open]")) app.BackButton?.show();
      else if (pathname === "/telegram" || home) app.BackButton?.hide();
      else app.BackButton?.show();
    };
    const back = () => {
      const dialogs = [
        ...document.querySelectorAll<HTMLDialogElement>("dialog[open]"),
      ];
      const dialog = dialogs.at(-1);
      if (dialog) {
        if (typeof dialog.requestClose === "function") dialog.requestClose();
        else if (
          dialog.dispatchEvent(new Event("cancel", { cancelable: true }))
        )
          dialog.close();
        return;
      }
      const target = miniAppBackTarget(pathname, location.hash);
      const [path, hash = ""] = target.split("#");
      if (path === pathname) location.hash = hash;
      else router.replace(target);
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open"],
    });
    app.BackButton?.onClick(back);
    window.addEventListener("hashchange", sync);
    return () => {
      observer.disconnect();
      app.BackButton?.offClick(back);
      window.removeEventListener("hashchange", sync);
    };
  }, [state.app, pathname, router]);
  return (
    <Context.Provider value={state}>
      {load && (
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="afterInteractive"
          onReady={onReady}
          onError={() => setState({ app: null, status: "error" })}
        />
      )}
      {children}
    </Context.Provider>
  );
}
export function useTelegram() {
  return useContext(Context);
}
