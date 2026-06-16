"use client";

import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline";

const variants: Record<Variant, string> = {
  primary:
    "bg-grad-accent text-white shadow-glow hover:brightness-110 active:brightness-95",
  ghost: "bg-black/[0.04] text-ink hover:bg-black/[0.07] border border-line",
  outline: "bg-transparent text-ink border border-line hover:bg-black/[0.04]",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
