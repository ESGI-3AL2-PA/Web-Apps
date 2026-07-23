import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { NotificationRefType, NotificationResponseDto } from "@repo/contracts";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "../api-service/notifications.service";
import { useSocket } from "../sockets/socket-context";
import { formatRelative } from "../lib/format";

/**
 * Composant React : cloche de notifications dans le header.
 *
 * Affiche un badge de non-lus, un menu déroulant listant les 15 dernières
 * notifications et se rafraîchit en direct via l'événement socket
 * `notification:new`. Marque les notifications comme lues et route vers la
 * ressource concernée au clic.
 */

// Traduit la ref d'une notification en route interne. Les types sans identifiant
// pointent vers leur page de liste ; les refId de `message` sont des identifiants
// de message (pas de conversation), donc ils renvoient aussi vers la liste.
function routeForNotification(refType: NotificationRefType, refId?: string): string | null {
  switch (refType) {
    case "listing":
      return refId ? `/annonce/${refId}` : null;
    case "conversation":
      return refId ? `/messages/${refId}` : null;
    case "message":
      return "/messages";
    case "contract":
      return "/mes-contrats";
    case "event":
      return "/evenements";
    case "vote":
      return "/sondages";
    case "incident":
      return "/incidents";
    default:
      return null;
  }
}

export default function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [items, setItems] = useState<NotificationResponseDto[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Charge les 15 dernières notifications ; le drapeau `ignore` évite un setState
  // après démontage si la requête revient trop tard.
  const load = useCallback(() => {
    let ignore = false;
    getNotifications({ limit: 15 })
      .then((page) => {
        if (!ignore) setItems(page.data);
      })
      .catch(() => {
        if (!ignore) setItems([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(load, [load]);

  // Rafraîchissement en direct : recharge quand le serveur pousse une notification.
  useEffect(() => {
    if (!socket) return;
    const onNew = () => load();
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [socket, load]);

  // Ferme le menu au clic en dehors du composant.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const toggle = () => {
    setOpen((o) => {
      if (!o) load();
      return !o;
    });
  };

  // Marque une notification comme lue de façon optimiste ; recharge si l'appel échoue
  // pour resynchroniser l'état affiché avec le serveur.
  const markOne = async (n: NotificationResponseDto) => {
    if (n.read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    await markNotificationRead(n.id).catch(() => load());
  };

  const onNotificationClick = (n: NotificationResponseDto) => {
    void markOne(n);
    const route = n.refType ? routeForNotification(n.refType, n.refId) : null;
    if (route) {
      setOpen(false);
      navigate(route);
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    await markAllNotificationsRead().catch(() => load());
  };

  return (
    <div
      ref={ref}
      className="relative shrink-0"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
    >
      <button
        ref={buttonRef}
        onClick={toggle}
        aria-label={t("notifications.title")}
        aria-expanded={open}
        aria-controls="notification-menu"
        className="relative flex size-9 items-center justify-center rounded-lg text-base-content/70 hover:bg-base-200 hover:text-primary"
      >
        <span className="icon-[tabler--bell] size-[22px]" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-error-content">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          id="notification-menu"
          className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-box border border-base-content/10 bg-base-100 shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-base-content/10 px-4 py-2.5">
            <span className="text-sm font-bold text-base-content">{t("notifications.title")}</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-primary hover:underline">
                {t("notifications.markAll")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-base-content/60">{t("notifications.empty")}</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => onNotificationClick(n)}
                    className={`flex w-full items-start gap-2 border-b border-base-content/5 px-4 py-3 text-left hover:bg-base-200 ${
                      n.read ? "" : "bg-primary/5"
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-base-content">{n.title}</span>
                      <span className="block text-xs text-base-content/70">{n.message}</span>
                      <span className="mt-0.5 block text-[10px] text-base-content/50">
                        {formatRelative(n.createdAt)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
