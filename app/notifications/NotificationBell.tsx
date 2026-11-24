"use client";
import { useLocale as useJupLocale } from "../i18n/LocaleProvider";

import Link from "next/link";
import { Icon } from "../ui/Icon";
import { roleHome, type Account } from "../lib/platform";
import type { NotificationState } from "./useNotifications";
export function NotificationBell({
  role,
  state,
}: {
  role: Account["role"];
  state: NotificationState;
}) {
  const { t: tr } = useJupLocale();

  const count = state.data?.unread ?? 0;
  return (
    <Link
      className="notificationBell"
      href={roleHome(role).replace(/^\/findbuddy/, "") + "#notifications"}
      aria-label={tr(
        tr("Уведомления{0}", [count ? `: непрочитанных ${count}` : ""]),
      )}
      title={tr(
        state.error
          ? tr(
              "Не удалось обновить уведомления — откройте для повторной загрузки",
            )
          : tr("Ваши уведомления"),
      )}
    >
      <Icon name="bell" size={21} />
      <span className="notificationBellLabel">{tr("Уведомления")}</span>
      {count > 0 && (
        <span className="notificationBadge" aria-hidden="true">
          {tr(count > 99 ? "99+" : count)}
        </span>
      )}
      {state.error && <span aria-label={tr("Ошибка загрузки")}>!</span>}
    </Link>
  );
}
