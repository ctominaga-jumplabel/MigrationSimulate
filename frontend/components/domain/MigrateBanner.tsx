"use client";

import { Icon } from "@/components/layout/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { fmtPct } from "@/lib/format";
import { motion } from "framer-motion";
import Link from "next/link";

export interface MigStatItem {
  label: string;
  value: string;
  success?: boolean;
}

/**
 * Banner de PROJEÇÃO com Migrate (MigrateMind). Painel comparativo manual×Migrate
 * reutilizado nas telas que não recalculam o plano (Sprints, Timeline, Pipelines,
 * Órfãos): mostra o ganho % e um conjunto de estatísticas livres. Apenas
 * apresentação — os números vêm de `useMigrate` (ou de cálculo client-side
 * coerente com o motor, no caso dos órfãos).
 */
export function MigrateBanner({
  ganhoPct,
  title,
  subtitle,
  stats,
  showLink = true,
}: {
  ganhoPct: number;
  title: string;
  subtitle: string;
  stats: MigStatItem[];
  showLink?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-success/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-grad-accent shadow-glow">
              <Icon name="MagicStar" size={22} color="#fff" variant="Bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-ink">{title}</p>
                <Badge tone="success">−{fmtPct(ganhoPct, 1)}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
            </div>
          </div>

          <div className="flex flex-1 flex-wrap items-center gap-6">
            {stats.map((st) => (
              <div key={st.label}>
                <p className="text-[11px] uppercase tracking-wide text-ink-faint">
                  {st.label}
                </p>
                <p
                  className={`num mt-0.5 text-sm font-bold ${
                    st.success ? "text-success" : "text-ink"
                  }`}
                >
                  {st.value}
                </p>
              </div>
            ))}
          </div>

          {showLink && (
            <Link href="/migrate" className="ml-auto">
              <Button variant="ghost">
                Tempo de Desenvolvimento <Icon name="ArrowRight" size={16} />
              </Button>
            </Link>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
