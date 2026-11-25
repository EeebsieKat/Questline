// Tiny hand-rolled UI kit (dark) — buttons, modal, popover,
// inputs, swatches. No component library needed.
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
  type SelectHTMLAttributes,
} from "react";
import { X } from "lucide-react";
import type { Swatch } from "../lib/palette";

export function Button({
  variant = "subtle",
  size = "md",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "subtle" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors focus-ring disabled:opacity-50 disabled:pointer-events-none select-none";
  const sizes = size === "sm" ? "px-2 h-7 text-xs" : "px-3 h-9 text-sm";
  const variants = {
    primary: "bg-accent text-white hover:bg-accent/85",
    subtle: "bg-panel2 text-ink hover:bg-line border border-line",
    ghost: "text-dim hover:text-ink hover:bg-panel2",
    danger: "bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30",
  }[variant];
  return (
    <button className={`${base} ${sizes} ${variants} ${className}`} {...rest}>
      {children}
    </button>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-[2px] p-4 pt-[8vh] overflow-y-auto"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`panel-surface rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-md"} fade-in`}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
          <h2 className="text-sm font-semibold tracking-wide text-ink">{title}</h2>
          <button
            className="p-1 rounded-md text-dim hover:text-ink hover:bg-panel2 focus-ring"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-dim mb-1.5">{label}</span>
      {children}
      {hint ? <span className="block text-[11px] text-faint mt-1.5 leading-relaxed">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = "", ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full bg-canvas border border-line rounded-lg px-3 h-9 text-sm text-ink placeholder:text-faint focus-ring outline-none ${className}`}
      {...rest}
    />
  );
}

export function TextArea({ className = "", ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full bg-canvas border border-line rounded-lg px-3 py-2 text-sm text-ink placeholder:text-faint focus-ring outline-none resize-y ${className}`}
      {...rest}
    />
  );
}

export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`bg-canvas border border-line rounded-lg px-2.5 h-8 text-sm text-ink focus-ring outline-none ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Popover({
  trigger,
  children,
  align = "left",
  widthClass = "w-56",
}: {
  trigger: (p: { open: boolean; toggle: () => void }) => ReactNode;
  children: (p: { close: () => void }) => ReactNode;
  align?: "left" | "right";
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open ? (
        <div
          className={`absolute z-30 mt-1.5 ${widthClass} panel-surface rounded-xl p-2 shadow-xl fade-in ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children({ close: () => setOpen(false) })}
        </div>
      ) : null}
    </div>
  );
}

export function Swatches({
  list,
  value,
  onPick,
}: {
  list: Swatch[];
  value?: string | null;
  onPick: (hex: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {list.map((s) => (
        <button
          key={s.id}
          title={s.name}
          onClick={() => onPick(s.hex)}
          className={`h-6 w-6 rounded-md border-2 transition-transform hover:scale-110 ${
            value === s.hex ? "border-white" : "border-transparent"
          }`}
          style={{ backgroundColor: s.hex }}
        />
      ))}
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-block px-1.5 py-0.5 rounded border border-line bg-panel2 text-[10px] font-mono text-dim">
      {children}
    </kbd>
  );
}

export function Divider() {
  return <div className="h-px bg-line my-3" />;
}
