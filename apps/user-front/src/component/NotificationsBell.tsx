import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NotificationResponseDto } from "@repo/contracts";
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../api-service/api";

const NotificationsBell = () => {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<NotificationResponseDto[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await getNotifications({ limit: 20 });
      setItems(res.data);
    } catch {
      /* keep whatever we had */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unread = items.filter((n) => !n.read).length;

  const onRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markNotificationRead(id);
    } catch {
      load();
    }
  };

  const onMarkAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllNotificationsRead();
    } catch {
      load();
    }
  };

  const onDelete = async (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      load();
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short" });

  return (
    <details className="dropdown relative" onToggle={(e) => e.currentTarget.open && load()}>
      <summary
        className="btn btn-ghost btn-circle list-none cursor-pointer [&::-webkit-details-marker]:hidden"
        aria-label={t("header.notifications")}
      >
        <span className="indicator">
          <span aria-hidden="true">🔔</span>
          {unread > 0 && (
            <span className="badge badge-primary badge-xs indicator-item">{unread > 9 ? "9+" : unread}</span>
          )}
        </span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-80 rounded-box border border-base-content/10 bg-base-100 p-2 shadow-lg">
        <div className="flex items-center justify-between px-2 py-1">
          <span className="font-bold text-base-content">{t("notifications.title")}</span>
          {unread > 0 && (
            <button className="btn btn-ghost btn-xs" onClick={onMarkAll}>
              {t("notifications.markAllRead")}
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-base-content/60">{t("notifications.empty")}</p>
        ) : (
          <ul className="max-h-96 divide-y divide-base-content/10 overflow-y-auto">
            {items.map((n) => (
              <li key={n.id} className={`flex items-start gap-2 rounded-md px-2 py-2 ${n.read ? "" : "bg-primary/5"}`}>
                <button
                  className="flex-1 text-left"
                  onClick={() => !n.read && onRead(n.id)}
                  disabled={n.read}
                  aria-label={n.title}
                >
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />}
                    <span className="text-sm font-medium text-base-content">{n.title}</span>
                  </div>
                  <p className="text-xs text-base-content/70">{n.message}</p>
                  <span className="text-[11px] text-base-content/50">{formatDate(n.createdAt)}</span>
                </button>
                <button
                  className="btn btn-ghost btn-xs"
                  onClick={() => onDelete(n.id)}
                  aria-label={t("notifications.delete")}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
};

export default NotificationsBell;
