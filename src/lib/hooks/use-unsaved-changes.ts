"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Leave =
  { kind: "href"; href: string } | { kind: "back" } | { kind: "action"; run: () => void };

/**
 * Guards a dirty form. Closing the tab asks through `beforeunload`; tapping an in-app link, the
 * browser back button or `requestLeave` open an in-page confirm instead (never `window.confirm`).
 * Render the dialog while `pending` is set, then call `discard` or `keepEditing`.
 */
export function useUnsavedChanges(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<Leave | null>(null);
  const dirtyRef = useRef(dirty);
  const sentinel = useRef(false);
  const bypass = useRef(false);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setPending({ kind: "href", href: url.pathname + url.search + url.hash });
    };
    const onPopState = () => {
      if (bypass.current) return;
      // Back was pressed: put the page back and ask first.
      history.pushState(null, "", location.href);
      setPending({ kind: "back" });
    };
    if (!sentinel.current) {
      history.pushState(null, "", location.href);
      sentinel.current = true;
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [dirty]);

  // Clean again (saved or left) while our extra history entry is still there: step over it.
  const stepOver = useCallback(() => {
    if (!sentinel.current || bypass.current) return;
    sentinel.current = false;
    history.back();
  }, []);
  useEffect(() => {
    if (!dirty) stepOver();
  }, [dirty, stepOver]);
  useEffect(() => stepOver, [stepOver]);

  const requestLeave = useCallback((run: () => void) => {
    if (dirtyRef.current) setPending({ kind: "action", run });
    else run();
  }, []);
  const keepEditing = useCallback(() => setPending(null), []);
  const discard = useCallback(() => {
    const leave = pending;
    setPending(null);
    if (!leave) return;
    bypass.current = leave.kind !== "action";
    if (leave.kind === "href") router.replace(leave.href);
    else if (leave.kind === "back") history.go(-2);
    else leave.run();
  }, [pending, router]);

  return { pending, requestLeave, keepEditing, discard };
}
