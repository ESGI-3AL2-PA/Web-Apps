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

const STYLES: Record<ToastType, string> = {
  success: "alert-success",
  error: "alert-error",
  info: "alert-info",
};
const ICONS: Record<ToastType, string> = {
  success: "icon-[tabler--circle-check]",
  error: "icon-[tabler--alert-circle]",
  info: "icon-[tabler--info-circle]",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, type }]);
      timersRef.current.push(window.setTimeout(() => dismiss(id), 4000));
    },
    [dismiss],
  );

  // Clear any pending auto-dismiss timers on unmount so they don't setState afterwards.
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

// eslint-disable-next-line react-refresh/only-export-components -- provider + its hook colocated
export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
