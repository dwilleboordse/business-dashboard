import { ReactNode } from "react";

export function Card({
  title, subtitle, right, children, className = "",
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`bg-panel border border-border rounded-2xl p-5 ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between mb-4 gap-3">
          <div>
            {title && <h3 className="text-base font-semibold tracking-tight">{title}</h3>}
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}
