"use client";

import { cn } from "@/lib/cn";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { GROUPS, NAV } from "./nav";

/** Navegação mobile: botão hambúrguer + drawer deslizante. Visível só abaixo de `lg`. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Portal só após montar no cliente (evita mismatch de SSR).
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fecha o drawer sempre que a rota muda.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Trava o scroll do body enquanto o drawer está aberto.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Mesmo critério de "ativo" do Sidebar (maior prefixo que casa).
  const activeHref = useMemo(() => {
    const matches = NAV.filter((n) =>
      n.href === "/"
        ? pathname === "/"
        : pathname === n.href || pathname.startsWith(n.href + "/")
    );
    return matches.sort((a, b) => b.href.length - a.href.length)[0]?.href;
  }, [pathname]);

  return (
    <>
      <button
        type="button"
        aria-label="Abrir menu"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-xl border border-line bg-black/[0.03] text-ink-muted transition-colors hover:text-ink lg:hidden"
      >
        <Icon name="HambergerMenu" size={20} />
      </button>

      {mounted &&
        createPortal(
          <AnimatePresence>
            {open && (
              <div className="fixed inset-0 z-[60] lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-ink/30 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-base-900/95 backdrop-blur-xl"
            >
              <div className="flex items-center justify-between px-5 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-grad-accent shadow-glow">
                    <Icon name="Routing" size={20} color="#fff" variant="Bold" />
                  </div>
                  <div className="leading-tight">
                    <p className="text-base font-black tracking-tight text-ink">Cogna</p>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                      Mission Control
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Fechar menu"
                  onClick={() => setOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:text-ink"
                >
                  <Icon name="CloseCircle" size={20} />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-2">
                {GROUPS.map((group) => (
                  <div key={group.key} className="mb-5">
                    <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                      {group.label}
                    </p>
                    <div className="space-y-1">
                      {NAV.filter((n) => n.group === group.key).map((item) => {
                        const active = item.href === activeHref;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                              active
                                ? "border border-accent/30 bg-accent/10 text-accent-soft"
                                : "text-ink-muted hover:bg-black/[0.04] hover:text-ink"
                            )}
                          >
                            <Icon
                              name={item.icon}
                              size={18}
                              variant={active ? "Bold" : "Linear"}
                            />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>
            </motion.aside>
          </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}
