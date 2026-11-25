"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
export type Thread = {
  id: string;
  as_student: boolean;
  peer_id: string;
  peer_name: string;
  last_at: string;
  last_body: string;
  unread: number;
};
type InboxList = { threads: Thread[]; unread: number };

export function inboxApi<T>(
  action: string,
  data: Record<string, unknown> = {},
) {
  return api<T>("", "inbox", { ...data, action });
}
export function useInbox(userId: string | null, open: boolean) {
  const [state, setState] = useState<{ user: string; list: InboxList } | null>(
    null,
  );
  const [failure, setFailure] = useState<{
    user: string;
    message: string;
  } | null>(null);
  const request = useRef(0);
  const owner = useRef(userId);
  const refresh = useCallback(async () => {
    if (!userId || owner.current !== userId) return;
    const version = ++request.current;
    try {
      const list = await inboxApi<InboxList>("list");
      if (request.current !== version || owner.current !== userId) return;
      setState((current) =>
        current?.user === userId &&
        JSON.stringify(current.list) === JSON.stringify(list)
          ? current
          : { user: userId, list },
      );
      setFailure(null);
    } catch (e) {
      if (request.current !== version || owner.current !== userId) return;
      setFailure({
        user: userId,
        message:
          e instanceof Error ? e.message : "Не удалось загрузить диалоги.",
      });
    }
  }, [userId]);
  useEffect(() => {
    owner.current = userId;
    if (!userId) return;
    let done = false,
      timer: number;
    async function poll() {
      if (!document.hidden) await refresh();
      if (!done) timer = window.setTimeout(poll, open ? 5500 : 16000);
    }
    void poll();
    return () => {
      done = true;
      owner.current = null;
      clearTimeout(timer);
    };
  }, [userId, open, refresh]);
  return {
    list: state?.user === userId ? state?.list : null,
    error: failure?.user === userId ? failure.message : "",
    refresh,
  };
}
