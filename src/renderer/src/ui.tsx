import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }): JSX.Element {
  return <button type="button" className={`ui-button ui-button--${variant} ui-button--${size} ${className}`.trim()} {...props}>{children}</button>;
}

export function StatusBanner({ tone = "info", title, children, action }: { tone?: "info" | "success" | "warning" | "danger"; title: string; children: ReactNode; action?: ReactNode }): JSX.Element {
  const icon = tone === "success" ? "✓" : tone === "warning" ? "!" : tone === "danger" ? "×" : "i";
  return <section className={`status-banner status-banner--${tone}`} role={tone === "danger" ? "alert" : "status"}><span className="status-banner__icon" aria-hidden="true">{icon}</span><div><strong>{title}</strong><p>{children}</p></div>{action && <div className="status-banner__action">{action}</div>}</section>;
}

export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }): JSX.Element {
  return <section className="empty-state"><span className="empty-state__icon" aria-hidden="true">▦</span><div><h2>{title}</h2><p>{children}</p>{action && <div>{action}</div>}</div></section>;
}

export function SegmentedControl<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; label: string }): JSX.Element {
  return <div className="segmented-control" role="tablist" aria-label={label}>{options.map((option) => <button type="button" role="tab" aria-selected={value === option.value} className={value === option.value ? "active" : ""} key={option.value} onClick={() => onChange(option.value)}>{option.label}</button>)}</div>;
}

export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, tone = "danger" }: { title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; tone?: "danger" | "primary" }): JSX.Element {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const cancelHandler = useRef(onCancel);
  cancelHandler.current = onCancel;
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") { cancelHandler.current(); return; }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); previousFocus?.focus(); };
  }, []);
  return <div className="confirm-dialog-backdrop" role="presentation" onMouseDown={onCancel}><section ref={dialogRef} className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" onMouseDown={(event) => event.stopPropagation()}><h2 id="confirm-dialog-title">{title}</h2><p>{children}</p><div className="confirm-dialog__actions"><button ref={cancelRef} type="button" className="ui-button ui-button--secondary ui-button--md" onClick={onCancel}>취소</button><Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button></div></section></div>;
}

export function Card({ title, description, children, action, className = "" }: { title?: string; description?: string; children?: ReactNode; action?: ReactNode; className?: string }): JSX.Element {
  return <section className={`ui-card ${className}`.trim()}>{(title || description || action) && <header className="ui-card__header">{(title || description) && <div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>}{action}</header>}{children && <div className="ui-card__body">{children}</div>}</section>;
}

export function SectionHeader({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }): JSX.Element {
  return <header className="section-header"><div><h2>{title}</h2>{children && <p>{children}</p>}</div>{action}</header>;
}

export function StatusPill({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode }): JSX.Element {
  return <span className={`status-pill status-pill--${tone}`}><span aria-hidden="true">{tone === "success" ? "✓" : tone === "warning" ? "!" : tone === "danger" ? "×" : "•"}</span>{children}</span>;
}

export function Toast({ children, tone = "success", onDismiss }: { children: ReactNode; tone?: "success" | "warning" | "danger"; onDismiss?: () => void }): JSX.Element {
  useEffect(() => { const timer = window.setTimeout(() => onDismiss?.(), 4000); return () => window.clearTimeout(timer); }, [onDismiss]);
  return <div className={`toast toast--${tone}`} role="status"><span>{children}</span>{onDismiss && <button type="button" className="toast__close" aria-label="알림 닫기" onClick={onDismiss}>×</button>}</div>;
}

export function InlineError({ id, children }: { id?: string; children: ReactNode }): JSX.Element {
  return <p id={id} className="inline-error" role="alert">{children}</p>;
}

export function SeatCell({ seatLabel, studentLabel, state = "default" }: { seatLabel: string; studentLabel: string; state?: "default" | "empty" | "selected-first" | "selected-second" | "violation" | "highlighted" }): JSX.Element {
  const stateLabel = state === "selected-first" ? "첫 번째 선택" : state === "selected-second" ? "두 번째 선택" : state === "violation" ? "조건 위반" : state === "highlighted" ? "강조됨" : state === "empty" ? "빈 자리" : "";
  return <div className={`seat-cell seat-cell--${state}`} aria-label={`${seatLabel} ${studentLabel}${stateLabel ? `, ${stateLabel}` : ""}`}><span>{seatLabel}</span><strong>{studentLabel}</strong>{stateLabel && <em>{stateLabel}</em>}</div>;
}
