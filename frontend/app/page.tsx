"use client";

import { CategoryChart } from "@/components/charts/CategoryChart";
import { EffortDonut } from "@/components/charts/EffortDonut";
import { ScenarioCompare } from "@/components/domain/ScenarioCompare";
import { Icon } from "@/components/layout/Icon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { KpiCard } from "@/components/ui/KpiCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { fmtDec, fmtHoras, fmtInt, fmtPct, diasParaAnos } from "@/lib/format";
import { useCatalog, useMigrate, useMigrateGain, useParams, useScenarios } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

export default function OverviewPage() {
  const params = useParams();
  const cenario = useSim((s) => s.cenario);
  const diasUteisMes = useSim((s) => s.dias_uteis_mes);
  const gain = useMigrateGain();
  const { data: scn, isLoading: lScn } = useScenarios(params);
  const { data: cat, isLoading: lCat } = useCatalog();
  const { data: mig } = useMigrate(params, gain);
  const [metric, setMetric] = useState<"n_sas" | "soma_horas">("n_sas");

  const active = scn?.[cenario];
  const migActive = mig?.[cenario];
  const economia = scn ? scn.bruto.esforco_total - scn.sem_dup.esforco_total : 0;

  return (
    <div className="space-y-8">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border border-line bg-base-800/80 px-7 py-10 backdrop-blur-xl md:px-10 md:py-14">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 left-1/3 h-72 w-72 rounded-full bg-electric/15 blur-3xl" />
        <div className="relative">
          <Badge tone="accent" className="mb-4">
            <Icon name="Routing" size={13} variant="Bold" /> Migração SAS → Databricks
          </Badge>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-ink md:text-6xl">
            Cogna Migration
            <br />
            <span className="bg-grad-accent bg-clip-text text-transparent">
              Mission Control
            </span>
          </h1>
          {/* md:text-[1rem] (não md:text-base): a paleta tem uma cor `base`, então
              `text-base` também emite color:#e9ebf3 (cor do fundo) e, na camada
              responsiva, sobrescreveria o text-ink — deixando o texto invisível. */}
          <p className="mt-5 max-w-2xl text-sm font-medium leading-relaxed text-ink md:text-[1rem]">
            Central executiva para simular esforço, duração, sprints e risco da
            migração da base SAS (3.198 EGPs · 54.972 arquivos) para Databricks /
            PySpark. Ajuste as alavancas e veja o impacto recalculado ao vivo —
            todos os números vêm do motor de cálculo determinístico.
          </p>
        </div>
      </section>

      {/* KPIs principais */}
      {lScn || !active ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Esforço total"
            value={active.esforco_total}
            format={(v) => fmtHoras(v)}
            icon={<Icon name="Flash" size={20} variant="Bold" />}
            sub={`cenário ${cenario === "bruto" ? "Bruto" : "Sem-dup"} · ×K ${params.K}`}
            hint="Σ horas .sas + overhead de Job, multiplicado pelo fator K. Vem de core.compute_scenarios."
          />
          <KpiCard
            label="Duração"
            value={active.duracao_dias_uteis}
            format={(v) => fmtDec(v) + " dias"}
            accent="electric"
            icon={<Icon name="Calendar1" size={20} variant="Bold" />}
            sub={diasParaAnos(active.duracao_dias_uteis, diasUteisMes)}
            hint="Dias úteis = esforço ÷ (nº consultores × horas/dia). Mais consultores reduzem a duração, não o esforço."
            delay={0.05}
          />
          <KpiCard
            label="Nº de sprints"
            value={active.n_sprints}
            format={(v) => fmtInt(v)}
            icon={<Icon name="Calendar" size={20} variant="Bold" />}
            sub="10 dias úteis cada"
            hint="esforço ÷ capacidade do sprint (nº consultores × horas/dia × 10)."
            delay={0.1}
          />
          <KpiCard
            label="Economia Bruto→Sem-dup"
            value={economia}
            format={(v) => fmtHoras(v)}
            accent="electric"
            icon={<Icon name="TrendDown" size={20} variant="Bold" />}
            sub="potencial ao colapsar duplicatas"
            hint="Diferença de esforço entre Bruto e Sem-dup (por família). É o ganho de tratar as 71% de duplicatas."
            delay={0.15}
          />
          <KpiCard
            label="EGPs (pipelines)"
            value={active.n_egps}
            format={(v) => fmtInt(v)}
            icon={<Icon name="Hierarchy" size={20} variant="Bold" />}
            sub={cenario === "sem_dup" ? "famílias canônicas" : "cada um vira um Job"}
            delay={0.2}
          />
          <KpiCard
            label="SAS órfãos"
            value={active.n_orfaos}
            format={(v) => fmtInt(v)}
            accent="electric"
            icon={<Icon name="DocumentText" size={20} variant="Bold" />}
            sub="sem overhead de Job"
            delay={0.25}
          />
          <KpiCard
            label="Horas de migração (.sas)"
            value={active.horas_sas}
            format={(v) => fmtHoras(v)}
            icon={<Icon name="Code" size={20} variant="Bold" />}
            sub="conversão de código"
            delay={0.3}
          />
          <KpiCard
            label="Overhead de Job"
            value={active.horas_job}
            format={(v) => fmtHoras(v)}
            accent="electric"
            icon={<Icon name="Settings" size={20} variant="Bold" />}
            sub="orquestração no Databricks"
            delay={0.35}
          />
        </div>
      )}

      {/* Aceleração com Migrate (MigrateMind) */}
      {migActive && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
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
                    <p className="text-sm font-bold text-ink">Aceleração com Migrate</p>
                    <Badge tone="success">−{fmtPct(migActive.ganho_pct, 1)}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    migração assistida (MigrateMind) — ganho de tempo por complexidade
                  </p>
                </div>
              </div>

              <div className="flex flex-1 flex-wrap items-center gap-6">
                <MigStat
                  label="Esforço"
                  value={`${fmtHoras(migActive.manual.esforco_total)} → ${fmtHoras(migActive.migrate.esforco_total)}`}
                />
                <MigStat
                  label="Duração"
                  value={`${fmtDec(migActive.manual.duracao_dias_uteis)} → ${fmtDec(migActive.migrate.duracao_dias_uteis)} dias`}
                />
                <MigStat
                  label="Sprints"
                  value={`${fmtInt(migActive.manual.n_sprints)} → ${fmtInt(migActive.migrate.n_sprints)}`}
                />
                <MigStat label="Economia" value={`−${fmtHoras(migActive.economia_horas)}`} success />
              </div>

              <Link href="/migrate" className="ml-auto">
                <Button variant="ghost">
                  Tempo de Desenvolvimento <Icon name="ArrowRight" size={16} />
                </Button>
              </Link>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Comparação + composição */}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <h2 className="mb-3 text-lg font-bold text-ink">Bruto × Sem duplicatas</h2>
          {scn ? <ScenarioCompare data={scn} /> : <Skeleton className="h-96" />}
        </div>
        <div>
          <h2 className="mb-3 text-lg font-bold text-ink">Composição do esforço</h2>
          <Card className="p-5">
            {active ? (
              <>
                <EffortDonut sas={active.horas_sas} job={active.horas_job} />
                <div className="mt-4 space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <span className="h-2.5 w-2.5 rounded-full bg-electric" />
                      Migração .sas
                    </span>
                    <span className="num font-semibold text-ink">
                      {fmtHoras(active.horas_sas)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-ink-muted">
                      <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                      Overhead de Job
                    </span>
                    <span className="num font-semibold text-ink">
                      {fmtHoras(active.horas_job)}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <Skeleton className="h-64" />
            )}
          </Card>
        </div>
      </div>

      {/* Distribuição por categoria */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Distribuição por complexidade</h2>
          <SegmentedControl
            size="sm"
            value={metric}
            onChange={setMetric}
            options={[
              { value: "n_sas", label: "Nº de .sas" },
              { value: "soma_horas", label: "Horas" },
            ]}
          />
        </div>
        <Card className="p-5">
          {lCat || !cat ? (
            <Skeleton className="h-64" />
          ) : (
            <CategoryChart data={cat.categoria_distribution} metric={metric} />
          )}
        </Card>
      </div>
    </div>
  );
}

function MigStat({
  label,
  value,
  success,
}: {
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p
        className={`num mt-0.5 text-sm font-bold ${
          success ? "text-success" : "text-ink"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
