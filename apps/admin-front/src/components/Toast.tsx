// Composant : système de notifications éphémères (toasts) + provider de contexte
// et hook useToast pour les déclencher depuis n'importe où dans l'admin-front.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

type ToastType = "success" | "error" | "info";
interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastApi {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

// Classe de couleur flyonui par type de toast.
const STYLES: Record<ToastType, string> = {
  success: "alert-success",
  error: "alert-error",
  info: "alert-info",
};
// Icône Tabler par type de toast.
const ICONS: Record<ToastType, string> = {
  success: "icon-[tabler--circle-check]",
  error: "icon-[tabler--alert-circle]",
  info: "icon-[tabler--info-circle]",
};

/**
 * Fournit le contexte des toasts et empile la file de notifications rendue en bas
 * à droite de l'écran. Chaque toast se ferme automatiquement au bout de 4 s ou au
 * clic sur sa croix. À poser haut dans l'arbre ; consommé via le hook useToast.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0); // compteur d'id monotone pour les clés de toast
  const timersRef = useRef<number[]>([]); // ids des timers d'auto-fermeture en attente

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Empile un toast et programme sa fermeture automatique après 4 s.
  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, type }]);
      timersRef.current.push(window.setTimeout(() => dismiss(id), 4000));
    },
    [dismiss],
  );

  // Au démontage : purge les timers d'auto-fermeture pour éviter un setState post-démontage.
  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    },
    [],
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 end-4 z-[60] flex flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={`alert ${STYLES[item.type]} shadow-lg`}
            // Erreur = annonce assertive (interrompt le lecteur d'écran) ; sinon annonce polie.
            role={item.type === "error" ? "alert" : "status"}
            aria-live={item.type === "error" ? "assertive" : "polite"}
          >
            <span className={`${ICONS[item.type]} size-5`} />
            <span>{item.message}</span>
            <button
              type="button"
              className="btn btn-circle btn-ghost btn-xs ms-auto"
              aria-label={t("common.table.dismiss")}
              onClick={() => dismiss(item.id)}
            >
              <span className="icon-[tabler--x] size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Hook d'accès à l'API des toasts. Lève si utilisé hors d'un ToastProvider. */
// eslint-disable-next-line react-refresh/only-export-components -- provider et son hook colocalisés
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
