import { cn } from "@/lib/cn";
import { ReactNode } from "react";

type Tone = "neutral" | "accent" | "electric" | "success" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-ink-muted border-line",
  accent: "bg-accent/10 text-accent-soft border-accent/30",
  electric: "bg-electric/10 text-electric-soft border-electric/30",
  success: "bg-success/10 text-success border-success/30",
  warn: "bg-warn/10 text-warn border-warn/30",
  danger: "bg-danger/10 text-danger border-danger/30",
};

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// Mapeia categoria de complexidade → tom.
export function categoriaTone(categoria: string): Tone {
  switch (categoria) {
    case "Trivial":
      return "neutral";
    case "Simples":
      return "electric";
    case "Médio":
      return "warn";
    case "Complexo":
      return "accent";
    case "Muito Complexo":
      return "danger";
    default:
      return "neutral";
  }
}
