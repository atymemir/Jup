"use client";
import Link from "next/link";
import { Icon } from "../ui/Icon";
import { roleHome, type Account } from "../lib/platform";
import type { NotificationState } from "./useNotifications";
export function NotificationBell({ role, state }: { role: Account["role"]; state: NotificationState }) {
 const count = state.data?.unread ?? 0;
 return <Link className="notificationBell" href={roleHome(role).replace(/^\/findbuddy/, "") + "#notifications"} aria-label={`Уведомления${count ? `: непрочитанных ${count}` : ""}`} title={state.error ? "Не удалось обновить уведомления — откройте для повторной загрузки" : "Ваши уведомления"}><Icon name="bell" size={21} /><span className="notificationBellLabel">Уведомления</span>{count > 0 && <span className="notificationBadge" aria-hidden="true">{count > 99 ? "99+" : count}</span>}{state.error && <span aria-label="Ошибка загрузки">!</span>}</Link>;
}
