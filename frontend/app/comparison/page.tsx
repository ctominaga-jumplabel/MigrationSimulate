"use client";

import { Icon } from "@/components/layout/Icon";
import { Badge, categoriaTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { LeverSlider } from "@/components/ui/Lever";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  DURACAO_UNIDADES,
  type DuracaoUnidade,
  fmtDec,
  fmtDuracao,
  fmtHoras,
  fmtInt,
  fmtPct,
} from "@/lib/format";
import { useComparison, useMigrateGain, useParams } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import type { ComparisonScenario, DuracaoBreakdown } from "@/lib/types";
import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

export default function ComparisonPage() {
  const s = useSim();
  const params = useParams();
  const gain = useMigrateGain();
  const { data, isLoading } = useComparison(params, gain);
  const [unidade, setUnidade] = useState<DuracaoUnidade>("anos");

  const active = data?.[s.cenario];
  const cfg = DURACAO_UNIDADES.find((u) => u.value === unidade)!;

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Comparativo"
        title="Cliente × Consultores"
        description="A mesma base SAS migrada de dois jeitos: manualmente pela equipe do CLIENTE versus com a ferramenta Migrate conduzida pelos CONSULTORES. O esforço (horas-homem) vem do motor; a duração traduz esse esforço para o tamanho de cada equipe. Compare por horas, dias, meses ou anos — com ou sem duplicados."
        actions={
          <SegmentedControl
            size="sm"
            value={s.cenario}
            onChange={s.setCenario}
            options={[
              { value: "bruto", label: "Com duplicados" },
              { value: "sem_dup", label: "Sem duplicados" },
            ]}
          />
        }
      />

      {/* Equipes (alavancas compartilhadas com o Scenario Builder) */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Tamanho das equipes</h3>
          <Link href="/scenario">
            <Button variant="ghost">
              <Icon name="Setting4" size={16} /> Mais alavancas
            </Button>
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          <LeverSlider
            label="Colaboradores do cliente"
            value={s.n_colaboradores}
            min={1}
            max={200}
            unit="pessoas"
            onChange={(v) => s.set({ n_colaboradores: v })}
            hint="Equipe do CLIENTE na migração manual (até 200 pessoas)."
          />
          <LeverSlider
            label="Consultores (com Migrate)"
            value={s.n_consultores}
            min={1}
            max={50}
            unit="pessoas"
            onChange={(v) => s.set({ n_consultores: v })}
            hint="Equipe de CONSULTORES usando a ferramenta Migrate."
          />
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Cada consultor / colaborador trabalha{" "}
          <span className="num font-semibold text-ink">{fmtDec(s.horas_dia, 1)} h/dia</span>{" "}
          · fator K {s.K}. Esforço total é fixo — mais pessoas reduzem a duração,
          não o trabalho acumulado.
        </p>
      </Card>

      {/* Seletor de unidade */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Duração da migração</h2>
        <SegmentedControl
          size="sm"
          value={unidade}
          onChange={(v) => setUnidade(v as DuracaoUnidade)}
          options={DURACAO_UNIDADES.map((u) => ({ value: u.value, label: u.label }))}
        />
      </div>

      {/* Protagonistas: cliente (manual) × consultores (Migrate) */}
      {isLoading || !active ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProtagonistCard
              tone="manual"
              titulo="Cliente · migração manual"
              icon="Profile2User"
              breakdown={active.manual}
              field={cfg.field}
              unidade={unidade}
            />
            <ProtagonistCard
              tone="migrate"
              titulo="Consultores · com Migrate"
              icon="MagicStar"
              breakdown={active.migrate}
              field={cfg.field}
              unidade={unidade}
            />
          </div>

          <VeredictoStrip active={active} unidade={unidade} field={cfg.field} />

          {/* Escopo por complexidade: processos (.egp) + .sas órfãos, separados */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink">
                Escopo por complexidade
              </h2>
              <Badge tone={s.cenario === "bruto" ? "accent" : "electric"}>
                {s.cenario === "bruto" ? "Com duplicados" : "Sem duplicados"}
              </Badge>
            </div>
            <p className="mb-3 text-xs text-ink-muted">
              Quantidade e esforço (×K {s.K}) por complexidade — processos{" "}
              <span className="font-semibold text-ink">.egp</span> (conversão dos
              seus .sas + overhead de Job) e arquivos{" "}
              <span className="font-semibold text-ink">.sas órfãos</span> (fora de
              qualquer .egp), separados e somáveis: juntos formam o esforço manual
              do cenário.
            </p>
            <ComplexidadeTable rows={active.complexidade} />
          </div>
        </>
      )}
    </div>
  );
}

function ProtagonistCard({
  tone,
  titulo,
  icon,
  breakdown,
  field,
  unidade,
}: {
  tone: "manual" | "migrate";
  titulo: string;
  icon: string;
  breakdown: DuracaoBreakdown;
  field: "duracao_horas" | "duracao_dias" | "duracao_meses" | "duracao_anos";
  unidade: DuracaoUnidade;
}) {
  const isMigrate = tone === "migrate";
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="relative overflow-hidden p-6">
        <div
          className={`pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl ${
            isMigrate ? "bg-success/20" : "bg-accent/15"
          }`}
        />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  isMigrate ? "bg-grad-accent shadow-glow" : "bg-black/[0.05]"
                }`}
              >
                <Icon
                  name={icon}
                  size={22}
                  variant="Bold"
                  color={isMigrate ? "#fff" : undefined}
                />
              </div>
              <div>
                <p className="text-sm font-bold text-ink">{titulo}</p>
                <p className="num mt-0.5 text-xs text-ink-muted">
                  {fmtInt(breakdown.n_pessoas)} pessoas · {/* */}
                  {fmtDec(breakdown.esforco_total / Math.max(1, breakdown.n_pessoas), 0)} h/pessoa
                </p>
              </div>
            </div>
            <Badge tone={isMigrate ? "success" : "neutral"}>
              {isMigrate ? "Migrate" : "Manual"}
            </Badge>
          </div>

          <div className="mt-5 text-5xl font-black text-ink">
            <AnimatedNumber
              value={breakdown[field]}
              format={(v) => fmtDuracao(v, unidade)}
            />
          </div>
          <p className="mt-1 text-xs text-ink-muted">duração estimada da migração</p>

          <div className="mt-5 rounded-xl border border-line bg-black/[0.03] px-4 py-3 text-xs text-ink-muted">
            Esforço total{" "}
            <span className="num font-semibold text-ink">
              {fmtHoras(breakdown.esforco_total)}
            </span>{" "}
            (horas-homem) — fixo, independe do tamanho da equipe.
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function VeredictoStrip({
  active,
  unidade,
  field,
}: {
  active: ComparisonScenario;
  unidade: DuracaoUnidade;
  field: "duracao_horas" | "duracao_dias" | "duracao_meses" | "duracao_anos";
}) {
  const dManual = active.manual[field];
  const dMigrate = active.migrate[field];
  const migrateMaisRapido = dMigrate <= dManual;
  const ratio =
    migrateMaisRapido && dMigrate > 0
      ? dManual / dMigrate
      : dManual > 0
      ? dMigrate / dManual
      : 0;

  return (
    <Card className="grid gap-px overflow-hidden bg-line p-0 sm:grid-cols-3">
      <StripCell
        label="Economia de esforço"
        value={`−${fmtHoras(active.economia_horas)}`}
        sub={`${fmtPct(active.ganho_pct, 1)} menos horas-homem com Migrate`}
        tone="success"
      />
      <StripCell
        label="Duração comparada"
        value={`${fmtDuracao(dManual, unidade)} → ${fmtDuracao(dMigrate, unidade)}`}
        sub="cliente manual → consultores com Migrate"
      />
      <StripCell
        label={migrateMaisRapido ? "Consultores entregam" : "Cliente (manual) entrega"}
        value={`${fmtDec(ratio, 1)}× mais rápido`}
        sub={
          migrateMaisRapido
            ? "mesmo com equipe menor, o Migrate acelera"
            : "a equipe maior do cliente reduz o calendário"
        }
        tone={migrateMaisRapido ? "success" : "neutral"}
      />
    </Card>
  );
}

function StripCell({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "neutral" | "success";
}) {
  return (
    <div className="bg-base-800 px-5 py-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p
        className={`num mt-1 text-lg font-bold ${
          tone === "success" ? "text-success" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-ink-muted">{sub}</p>
    </div>
  );
}

/** Escopo por complexidade: processos (.egp) e .sas órfãos — qtd + esforço. */
function ComplexidadeTable({
  rows,
}: {
  rows: ComparisonScenario["complexidade"];
}) {
  const totEgp = rows.reduce((a, r) => a + r.n_egp, 0);
  const totHEgp = rows.reduce((a, r) => a + r.horas_egp, 0);
  const totOrf = rows.reduce((a, r) => a + r.n_orfao, 0);
  const totHOrf = rows.reduce((a, r) => a + r.horas_orfao, 0);
  // Barras proporcionais ao ESFORÇO (a magnitude que importa no comparativo).
  const maxH = Math.max(1, ...rows.map((r) => Math.max(r.horas_egp, r.horas_orfao)));

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <div className="grid min-w-[560px] grid-cols-[1.1fr_1.3fr_1.3fr] items-center">
          <div className="border-b border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            Complexidade
          </div>
          <div className="border-b border-l border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            <span className="flex items-center gap-1.5">
              <Icon name="Hierarchy" size={14} /> Processos (.egp)
            </span>
          </div>
          <div className="border-b border-l border-line px-5 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
            <span className="flex items-center gap-1.5">
              <Icon name="DocumentText" size={14} /> .sas órfãos
            </span>
          </div>

          {rows.map((r, i) => (
            <motion.div
              key={r.categoria}
              className="contents"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="border-b border-line px-5 py-3">
                <Badge tone={categoriaTone(r.categoria)}>{r.categoria}</Badge>
              </div>
              <MetricCell
                qtd={r.n_egp}
                horas={r.horas_egp}
                pct={(r.horas_egp / maxH) * 100}
                barClass="bg-accent"
              />
              <MetricCell
                qtd={r.n_orfao}
                horas={r.horas_orfao}
                pct={(r.horas_orfao / maxH) * 100}
                barClass="bg-electric"
              />
            </motion.div>
          ))}

          {/* Totais */}
          <div className="px-5 py-3 text-sm font-bold text-ink">Total</div>
          <TotalCell qtd={totEgp} horas={totHEgp} />
          <TotalCell qtd={totOrf} horas={totHOrf} />
        </div>
      </div>
    </Card>
  );
}

/** Célula com quantidade (destaque), esforço em horas e barra por esforço. */
function MetricCell({
  qtd,
  horas,
  pct,
  barClass,
}: {
  qtd: number;
  horas: number;
  pct: number;
  barClass: string;
}) {
  return (
    <div className="border-b border-l border-line px-5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-sm font-semibold text-ink">{fmtInt(qtd)} un</span>
        <span className="num text-xs text-ink-muted">{fmtHoras(horas)}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className={`h-full rounded-full ${barClass}`}
        />
      </div>
    </div>
  );
}

function TotalCell({ qtd, horas }: { qtd: number; horas: number }) {
  return (
    <div className="border-l border-line px-5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-sm font-bold text-ink">{fmtInt(qtd)} un</span>
        <span className="num text-xs font-semibold text-ink-muted">
          {fmtHoras(horas)}
        </span>
      </div>
    </div>
  );
}
