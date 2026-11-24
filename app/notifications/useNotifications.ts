"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import type { NotificationList } from "../lib/notifications";

export function useNotifications(user: string | null) {
 const [snapshot, setSnapshot] = useState<{ user: string; filter: boolean; data: NotificationList } | null>(null);
 const [filter, setFilter] = useState(false);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");
 const [marking, setMarking] = useState(false);
 const [more, setMore] = useState(false);
 const owner = useRef(user);
 const generation = useRef(0);
 const working = useRef(false);
 const expanded = useRef(false);
 const refresh = useCallback(async () => {
  if (!user || owner.current !== user) return;
  const n = ++generation.current;
  try {
   const data = await api<NotificationList>("", "notifications", { action: "list", unread: filter });
   if (n !== generation.current || owner.current !== user) return;
   setSnapshot(current => current?.user === user && current.filter === filter && JSON.stringify(current.data) === JSON.stringify(data) ? current : { user, filter, data }); setMore(data.items.length === 50); setError("");
  } catch (e) {
   if (n === generation.current && owner.current === user) setError(e instanceof Error ? e.message : "Не удалось загрузить уведомления.");
  } finally { if (n === generation.current && owner.current === user) setLoading(false); }
 }, [user, filter]);
 useEffect(() => {
  owner.current = user;
  if (!user) return;
  expanded.current = false;
  let active = true;
  let timer: ReturnType<typeof setTimeout>;
  async function poll() {
   if (!document.hidden && !working.current && !expanded.current) await refresh();
   if (active) timer = setTimeout(poll, 20000);
  }
  void poll();
  const focus = () => { if (!document.hidden && !working.current && !expanded.current) void refresh(); };
  window.addEventListener("focus", focus);
  const invalidate = () => { generation.current++; };
  return () => { active = false; owner.current = null; invalidate(); clearTimeout(timer); window.removeEventListener("focus", focus); };
 }, [refresh, user]);
 const data = snapshot?.user === user && snapshot.filter === filter ? snapshot.data : null;
 async function read(ids: number[]) {
  if (!user || working.current || !ids.length) return;
  working.current = true; setMarking(true); generation.current++;
  try {
   const result = await api<NotificationList>("", "notifications", { action: "read", ids });
   if (owner.current === user) setError("");
   if (owner.current === user) setSnapshot(previous => previous?.user === user ? { ...previous, data: { unread: result.unread, items: previous.data.items.map(item => ids.includes(item.id) ? { ...item, read_at: item.read_at ?? new Date().toISOString() } : item).filter(item => !previous.filter || !item.read_at) } } : previous);
  } catch { if (owner.current === user) setError("Не удалось отметить уведомления. Попробуйте ещё раз."); }
  finally { working.current = false; setMarking(false); }
 }
 async function loadMore() {
  if (!data?.items.length || working.current || !user) return;
  working.current = true; setMarking(true);
  const n = ++generation.current;
  try {
   const next = await api<NotificationList>("", "notifications", { action: "list", unread: filter, before: data.items.at(-1)!.id });
   if (n !== generation.current || owner.current !== user) return;
   expanded.current = true;
   setSnapshot({ user, filter, data: { unread: next.unread, items: [...data.items, ...next.items.filter(item => !data.items.some(old => old.id === item.id))] } });
   setMore(next.items.length === 50); setError("");
  } catch { if (owner.current === user) setError("Не удалось загрузить предыдущие уведомления."); }
  finally { working.current = false; setMarking(false); }
 }
 return { data, loading: loading || (!data && !error), error, marking, more, read, loadMore, refresh: async () => { expanded.current = false; await refresh(); }, filter, setFilter };
}
export type NotificationState = ReturnType<typeof useNotifications>;
