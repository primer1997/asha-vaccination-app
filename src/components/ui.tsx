import React, { useEffect, useState } from "react";
import { AnimatePresence, animate, motion, type Variants } from "motion/react";
import { AlertTriangle, Inbox } from "lucide-react";

/* ---------------- Motion variants ---------------- */

export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.05 } },
};

export const listItem: Variants = {
  hidden: { opacity: 0, y: 18, scale: 0.985 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
  exit: { opacity: 0, scale: 0.96, transition: { duration: 0.16 } },
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 320, damping: 30 },
  },
};

/* ---------------- FadeIn wrapper ---------------- */

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Animated number ---------------- */

export function AnimatedNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const controls = animate(0, value, {
      duration: 0.9,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [value]);
  return <span className={className}>{display.toLocaleString("mr-IN")}</span>;
}

/* ---------------- Cards ---------------- */

export function Card({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, delay }}
      className={`rounded-2xl bg-white shadow-[0_8px_30px_-12px_rgba(2,44,34,0.25)] ring-1 ring-slate-900/5 ${className}`}
    >
      {children}
    </motion.section>
  );
}

export function StatCard({
  icon,
  label,
  value,
  accent,
  delay = 0,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 340, damping: 28, delay }}
      whileHover={{ y: -3 }}
      className="relative overflow-hidden rounded-2xl bg-white p-4 shadow-[0_8px_30px_-12px_rgba(2,44,34,0.25)] ring-1 ring-slate-900/5 sm:p-5"
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <div className="flex items-center gap-3">
        <div className="shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-500 sm:text-sm">{label}</p>
          <AnimatedNumber
            value={value}
            className="text-2xl font-extrabold text-slate-800 sm:text-3xl"
          />
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- Animated tabs ---------------- */

export interface TabDef<T extends string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
}

export function AnimatedTabs<T extends string>({
  tabs,
  active,
  onChange,
  namespace,
  className = "",
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  namespace: string;
  className?: string;
}) {
  return (
    <div className={`flex gap-1 rounded-2xl bg-slate-900/5 p-1.5 ${className}`}>
      {tabs.map((t) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`relative flex-1 rounded-xl px-2 py-2.5 text-sm font-bold transition-colors sm:text-[15px] ${
              isActive ? "text-emerald-950" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {isActive && (
              <motion.span
                layoutId={`${namespace}-pill`}
                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                className="absolute inset-0 rounded-xl bg-white shadow-md ring-1 ring-slate-900/10"
              />
            )}
            <span className="relative z-10 flex items-center justify-center gap-1.5">
              {t.icon}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------- Modal ---------------- */

export function Modal({
  open,
  onClose,
  children,
  maxWidth = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open ]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-emerald-950/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.93, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 14 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className={`relative max-h-[92vh] w-full ${maxWidth} overflow-y-auto rounded-3xl bg-white shadow-2xl`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------------- Confirm dialog ---------------- */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "होय, करा",
  cancelLabel = "रद्द करा",
  danger = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} maxWidth="max-w-sm">
      <div className="p-6 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18, delay: 0.08 }}
          className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${
            danger ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
          }`}
        >
          <AlertTriangle size={26} />
        </motion.div>
        <h3 className="text-lg font-extrabold text-slate-800">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onConfirm}
            disabled={busy}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-lg transition disabled:opacity-50 ${
              danger
                ? "bg-red-600 shadow-red-600/30 hover:bg-red-700"
                : "bg-emerald-700 shadow-emerald-700/30 hover:bg-emerald-800"
            }`}
          >
            {busy ? "थांबा..." : confirmLabel}
          </motion.button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Skeletons & empty states ---------------- */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4">
          <Skeleton className="h-5 w-2/5" />
          <Skeleton className="mt-2 h-4 w-3/5" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center"
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm ring-1 ring-slate-200"
      >
        {icon}
      </motion.div>
      <p className="text-base font-bold text-slate-600">{title}</p>
      {subtitle && <p className="mt-1 max-w-xs text-sm text-slate-400">{subtitle}</p>}
    </motion.div>
  );
}

export function InboxEmpty({ title, subtitle }: { title: string; subtitle?: string }) {
  return <EmptyState icon={<Inbox size={30} />} title={title} subtitle={subtitle} />;
}

/* ---------------- Vaccine chips ---------------- */

export function VaccineChips({ vaccines }: { vaccines: string[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(vaccines || []).map((v, i) => (
        <motion.span
          key={v}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: Math.min(i * 0.03, 0.3), type: "spring", stiffness: 500, damping: 25 }}
          className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800"
        >
          {v}
        </motion.span>
      ))}
    </div>
  );
}

/* ---------------- Form field ---------------- */

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center justify-between text-sm font-bold text-slate-700">
        <span>
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {hint && (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] font-medium text-slate-800 outline-none transition placeholder:text-slate-400 placeholder:font-normal focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/15";
