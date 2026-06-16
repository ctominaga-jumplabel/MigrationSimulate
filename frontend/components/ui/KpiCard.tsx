"use client";

import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import { ReactNode } from "react";
import { AnimatedNumber } from "./AnimatedNumber";
import { Card } from "./Card";
import { Tooltip } from "./Tooltip";

export function KpiCard({
  label,
  value,
  format,
  icon,
  hint,
  accent,
  sub,
  delay = 0,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  icon?: ReactNode;
  hint?: ReactNode;
  accent?: "accent" | "electric";
  sub?: ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="group relative overflow-hidden p-5">
        <div
          className={cn(
            "pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl transition-opacity",
            accent === "electric" ? "bg-electric/20" : "bg-accent/20",
            "opacity-40 group-hover:opacity-70"
          )}
        />
        <div className="relative flex items-start justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
            {label}
          </span>
          {icon && (
            <span
              className={cn(
                accent === "electric" ? "text-electric-soft" : "text-accent-soft"
              )}
            >
              {icon}
            </span>
          )}
        </div>
        <div className="relative mt-3 text-3xl font-bold text-ink">
          <AnimatedNumber value={value} format={format} />
        </div>
        {sub && <div className="relative mt-1 text-xs text-ink-muted">{sub}</div>}
        {hint && (
          <div className="relative mt-3">
            <Tooltip content={hint}>
              <span className="cursor-help text-[11px] text-ink-faint underline decoration-dotted underline-offset-2">
                o que é isto?
              </span>
            </Tooltip>
          </div>
        )}
      </Card>
    </motion.div>
  );
}
