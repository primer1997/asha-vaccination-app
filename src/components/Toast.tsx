import React, { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}

const ToastCtx = createContext<(text: string, kind?: ToastKind) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

const kindStyles: Record<ToastKind, string> = {
  success: "bg-emerald-900 text-white ring-emerald-700",
  error: "bg-red-900 text-white ring-red-700",
  info: "bg-slate-900 text-white ring-slate-700",
};

const kindIcons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="text-emerald-300 shrink-0" />,
  error: <AlertCircle size={18} className="text-red-300 shrink-0" />,
  info: <Info size={18} className="text-sky-300 shrink-0" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const push = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, kind }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed top-4 left-1/2 z-[100] flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -28, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.94 }}
              transition={{ type: "spring", stiffness: 480, damping: 34 }}
              className={`pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-2xl ring-1 ${kindStyles[t.kind]}`}
            >
              {kindIcons[t.kind]}
              <span className="leading-snug">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
