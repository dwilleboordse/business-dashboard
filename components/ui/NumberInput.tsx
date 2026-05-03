"use client";

import { useEffect, useState } from "react";

type Props = {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  placeholder?: string;
  className?: string;
  prefix?: string;
  suffix?: string;
};

export function NumberInput({ value, onChange, step, min, placeholder, className = "", prefix, suffix }: Props) {
  const [text, setText] = useState<string>(value === null || value === undefined ? "" : String(value));

  useEffect(() => {
    setText(value === null || value === undefined ? "" : String(value));
  }, [value]);

  const commit = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") return onChange(null);
    const n = Number(trimmed.replace(",", "."));
    onChange(Number.isFinite(n) ? n : null);
  };

  return (
    <div className={`flex items-center bg-panel2 border border-border rounded-md focus-within:border-accent transition ${className}`}>
      {prefix && <span className="px-2 text-xs text-muted">{prefix}</span>}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        placeholder={placeholder ?? "—"}
        className="bg-transparent w-full outline-none px-2 py-1.5 text-sm text-text placeholder:text-muted/50"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      {suffix && <span className="px-2 text-xs text-muted">{suffix}</span>}
    </div>
  );
}
