"use client";

import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";
import { Icon } from "@/components/layout/Icon";

/** Slider premium com rótulo, valor e explicação. */
export function LeverSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
          {label}
          {hint && (
            <Tooltip content={hint}>
              <Icon name="InfoCircle" size={14} className="text-ink-faint" />
            </Tooltip>
          )}
        </label>
        <span className="num rounded-lg bg-accent/10 px-2.5 py-0.5 text-sm font-bold text-accent-soft">
          {format ? format(value) : value}
          {unit ? ` ${unit}` : ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lever-range w-full"
        style={{
          background: `linear-gradient(to right, #8629ff ${pct}%, rgba(26,20,48,0.10) ${pct}%)`,
        }}
      />
    </div>
  );
}

export function LeverSelect<T extends string | number>({
  label,
  value,
  options,
  hint,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  hint?: string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {label}
        {hint && (
          <Tooltip content={hint}>
            <Icon name="InfoCircle" size={14} className="text-ink-faint" />
          </Tooltip>
        )}
      </label>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition-all",
              opt.value === value
                ? "border-accent/40 bg-accent/15 text-accent-soft shadow-glow"
                : "border-line bg-black/[0.03] text-ink-muted hover:text-ink"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function LeverNumber({
  label,
  value,
  step = 1,
  min = 0,
  unit,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  min?: number;
  unit?: string;
  hint?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-sm font-medium text-ink">
        {label}
        {hint && (
          <Tooltip content={hint}>
            <Icon name="InfoCircle" size={14} className="text-ink-faint" />
          </Tooltip>
        )}
      </label>
      <div className="flex items-center rounded-xl border border-line bg-black/[0.03]">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="px-3 py-2 text-ink-muted hover:text-ink"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          onChange={(e) => onChange(Math.max(min, Number(e.target.value)))}
          className="num w-full bg-transparent text-center text-sm font-bold text-ink outline-none"
        />
        <button
          onClick={() => onChange(value + step)}
          className="px-3 py-2 text-ink-muted hover:text-ink"
        >
          +
        </button>
        {unit && <span className="pr-3 text-xs text-ink-faint">{unit}</span>}
      </div>
    </div>
  );
}
