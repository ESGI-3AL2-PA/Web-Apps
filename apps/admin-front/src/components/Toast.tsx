import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

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
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message: string, type: ToastType = "success") => {
      const id = ++idRef.current;
      setItems((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 end-4 z-[60] flex flex-col gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            className={`alert ${STYLES[t.type]} shadow-lg`}
            role={t.type === "error" ? "alert" : "status"}
            aria-live={t.type === "error" ? "assertive" : "polite"}
          >
            <span className={`${ICONS[t.type]} size-5`} />
            <span>{t.message}</span>
            <button
              type="button"
              className="btn btn-circle btn-ghost btn-xs ms-auto"
              aria-label="Dismiss notification"
              onClick={() => dismiss(t.id)}
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
