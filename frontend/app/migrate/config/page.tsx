"use client";

import { Icon } from "@/components/layout/Icon";
import { Badge, categoriaTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LeverSlider } from "@/components/ui/Lever";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { fmtDec, fmtHoras, fmtInt, fmtPct } from "@/lib/format";
import { useCatalog, useMigrate, useMigrateGain, useParams } from "@/lib/hooks";
import { MIGRATE_GAIN_DEFAULTS, useSim } from "@/lib/store";
import Link from "next/link";

// Ordem canônica (fallback enquanto o catálogo não carrega).
const FALLBACK_ORDER = ["Trivial", "Simples", "Médio", "Complexo", "Muito Complexo"];

export default function MigrateConfigPage() {
  const s = useSim();
  const params = useParams();
  const gain = useMigrateGain();
  const { data: cat } = useCatalog();
  const { data } = useMigrate(params, gain);
  const active = data?.[s.cenario];

  const order = cat?.categoria_order ?? FALLBACK_ORDER;
  const defaults = cat?.migrate_gain_default ?? MIGRATE_GAIN_DEFAULTS;
  const dirty = order.some(
    (c) => Math.round(gain[c] ?? 0) !== Math.round(defaults[c] ?? 0)
  );

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Migrate · MigrateMind"
        title="Calibrar Migrate"
        description="Defina o ganho de produtividade da ferramenta Migrate por complexidade — a % de redução do esforço de conversão de código .sas em cada categoria. Os números alimentam a visão de Tempo de Desenvolvimento e os destaques de Migrate nas demais telas."
        actions={
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => s.resetMigrateGain()}
              disabled={!dirty}
            >
              <Icon name="Refresh" size={16} /> Restaurar padrões
            </Button>
            <Link href="/migrate">
              <Button variant="primary">
                <Icon name="MagicStar" size={16} /> Ver impacto
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        {/* Sliders por categoria */}
        <Card className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Ganho por complexidade</h3>
            {dirty && <Badge tone="warn">ajustado</Badge>}
          </div>
          {order.map((categoria) => {
            const def = Math.round(defaults[categoria] ?? 0);
            return (
              <div key={categoria} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge tone={categoriaTone(categoria)}>{categoria}</Badge>
                  <span className="text-[11px] text-ink-faint">padrão {def}%</span>
                </div>
                <LeverSlider
                  label="Ganho de tempo"
                  value={Math.round(gain[categoria] ?? def)}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(v) => s.setMigrateGain(categoria, v)}
                  hint="% de redução do esforço de conversão .sas nesta categoria. 90% = a migração assistida faz quase todo o trabalho; 0% = sem ganho."
                />
              </div>
            );
          })}
          <p className="rounded-xl border border-line bg-white/5 px-4 py-3 text-[11px] leading-relaxed text-ink-muted">
            O ganho incide só sobre a <span className="font-semibold text-ink">conversão de código</span>.
            O overhead de Job (orquestração no Databricks) é mantido — o Migrate
            automatiza a tradução SAS → PySpark, não a montagem dos Jobs.
          </p>
        </Card>

        {/* Impacto ao vivo */}
        <div className="space-y-4">
          <Card className="relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-success/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-ink-muted">
                  Ganho com a calibração atual
                </span>
                <SegmentedControl
                  size="sm"
                  value={s.cenario}
                  onChange={s.setCenario}
                  options={[
                    { value: "bruto", label: "Bruto" },
                    { value: "sem_dup", label: "Sem-dup" },
                  ]}
                />
              </div>
              <div className="mt-4 text-5xl font-black text-success">
                {active ? (
                  <AnimatedNumber
                    value={active.ganho_pct}
                    format={(v) => "−" + fmtPct(v, 1)}
                  />
                ) : (
                  "—"
                )}
              </div>
              <p className="mt-1 text-xs text-ink-muted">
                redução do esforço total (conversão + Job) × K {s.K}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <ImpactStat
                  label="Esforço com Migrate"
                  value={active ? fmtHoras(active.migrate.esforco_total) : "—"}
                  sub={active ? `manual ${fmtHoras(active.manual.esforco_total)}` : ""}
                />
                <ImpactStat
                  label="Economia"
                  value={active ? "−" + fmtHoras(active.economia_horas) : "—"}
                  sub="horas-homem"
                />
                <ImpactStat
                  label="Duração"
                  value={active ? fmtDec(active.migrate.duracao_dias_uteis) + " dias" : "—"}
                  sub={active ? `manual ${fmtDec(active.manual.duracao_dias_uteis)}` : ""}
                />
                <ImpactStat
                  label="Sprints"
                  value={active ? fmtInt(active.migrate.n_sprints) : "—"}
                  sub={active ? `manual ${fmtInt(active.manual.n_sprints)}` : ""}
                />
              </div>
            </div>
          </Card>

          <Card className="flex gap-3 p-4">
            <div className="mt-0.5 text-accent-soft">
              <Icon name="InfoCircle" size={20} variant="Bold" />
            </div>
            <p className="text-xs leading-relaxed text-ink-muted">
              Os ganhos por categoria são persistidos nesta sessão e aplicados em
              todas as telas que mostram o cenário Migrate. Use o cenário{" "}
              <span className="font-semibold text-ink">Bruto</span> para a base
              completa ou <span className="font-semibold text-ink">Sem-dup</span>{" "}
              para a base já deduplicada por família.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ImpactStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-base-900/40 px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="num mt-1 text-sm font-bold text-ink">{value}</p>
      {sub && <p className="num mt-0.5 text-[11px] text-ink-faint">{sub}</p>}
    </div>
  );
}
