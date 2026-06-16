"use client";

import { cn } from "@/lib/cn";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { NAV } from "./nav";

const GROUPS: { key: string; label: string }[] = [
  { key: "principal", label: "Comando" },
  { key: "planejamento", label: "Planejamento" },
  { key: "saída", label: "Saída" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-line bg-base-900/70 backdrop-blur-xl lg:flex">
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-accent shadow-glow">
          <Icon name="Routing" size={20} color="#fff" variant="Bold" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-ink">Mission Control</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
            Cogna · SAS → Databricks
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2">
        {GROUPS.map((group) => (
          <div key={group.key} className="mb-5">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
              {group.label}
            </p>
            <div className="space-y-1">
              {NAV.filter((n) => n.group === group.key).map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                      active
                        ? "text-white"
                        : "text-ink-muted hover:bg-white/5 hover:text-ink"
                    )}
                  >
                    {active && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-xl border border-accent/30 bg-accent/10"
                        transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">
                      <Icon
                        name={item.icon}
                        size={18}
                        variant={active ? "Bold" : "Linear"}
                      />
                    </span>
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-6 py-4">
        <p className="text-[10px] leading-relaxed text-ink-faint">
          Simulador de esforço — números via{" "}
          <span className="text-ink-muted">core.py</span>. v1.
        </p>
      </div>
    </aside>
  );
}
