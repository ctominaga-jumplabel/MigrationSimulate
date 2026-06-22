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
  fmtEsforco,
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
  const [unidadeEsforco, setUnidadeEsforco] = useState<DuracaoUnidade>("horas");

  const active = data?.[s.cenario];
  const cfg = DURACAO_UNIDADES.find((u) => u.value === unidade)!;

  return (
    <div className="space-y-7">
      <SectionHeader
        eyebrow="Comparativo"
        title="Cliente × Consultores"
        description="A mesma base SAS migrada de dois jeitos: manualmente pela equipe do CLIENTE versus com a ferramenta Migrate conduzida pelos CONSULTORES. O esforço (horas trabalhadas) vem do motor; a duração traduz esse esforço para o tamanho de cada equipe. Compare por horas, dias, meses ou anos — com ou sem duplicados."
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
        <div>
          <h2 className="text-lg font-bold text-ink">Duração da migração</h2>
          {(unidade === "meses" || unidade === "anos") && (
            <p className="mt-0.5 text-xs text-ink-muted">
              Em dias úteis: 1 mês ={" "}
              <span className="num font-semibold text-ink">
                {fmtInt(s.dias_uteis_mes)}
              </span>{" "}
              dias úteis · 1 ano = 12 meses (ajuste no Scenario Builder).
            </p>
          )}
        </div>
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

          {/* Esforço por complexidade: processos (.egp) + .sas órfãos, separados */}
          <div>
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-ink">
                Esforço por complexidade
              </h2>
              <div className="flex items-center gap-3">
                <UnidadeSelector value={unidadeEsforco} onChange={setUnidadeEsforco} />
                <Badge tone={s.cenario === "bruto" ? "accent" : "electric"}>
                  {s.cenario === "bruto" ? "Com duplicados" : "Sem duplicados"}
                </Badge>
              </div>
            </div>
            <p className="mb-3 text-xs text-ink-muted">
              Quantidade e esforço (×K {s.K}) por complexidade — processos{" "}
              <span className="font-semibold text-ink">.egp</span> (conversão dos
              seus .sas + overhead de Job) e arquivos{" "}
              <span className="font-semibold text-ink">SAS (sem EGP)</span> (fora de
              qualquer .egp), separados e somáveis. Cada célula compara o esforço{" "}
              <span className="font-semibold text-accent">manual</span> com o{" "}
              <span className="font-semibold text-success">Migrate</span>.
            </p>
            <ComplexidadeTable
              rows={active.complexidade}
              unidade={unidadeEsforco}
              horasDia={s.horas_dia}
              diasUteisMes={s.dias_uteis_mes}
            />
          </div>

          {/* Comparativo de tempo por complexidade: manual ÷ colaboradores ×
              Migrate ÷ consultores, separando .egp e .sas órfãos, com totalizador
              selecionável por complexidade. */}
          <ComplexidadeComparativo
            rows={active.complexidade}
            nColab={active.n_colaboradores}
            nCons={active.n_consultores}
            horasDia={s.horas_dia}
            diasUteisMes={s.dias_uteis_mes}
          />

          {/* Equipe híbrida: consultoria (Migrate) + cliente (manual) em paralelo,
              com % migrado pela consultoria editável por complexidade (.egp e .sas). */}
          <EquipeHibrida
            rows={active.complexidade}
            nColab={active.n_colaboradores}
            nCons={active.n_consultores}
            horasDia={s.horas_dia}
            diasUteisMes={s.dias_uteis_mes}
          />
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
            (horas trabalhadas) — fixo, independe do tamanho da equipe.
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
        sub={`${fmtPct(active.ganho_pct, 1)} menos horas trabalhadas com Migrate`}
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

/** Seletor de unidade (Horas/Dias/Meses/Anos) reaproveitado pelas seções. */
function UnidadeSelector({
  value,
  onChange,
}: {
  value: DuracaoUnidade;
  onChange: (u: DuracaoUnidade) => void;
}) {
  return (
    <SegmentedControl
      size="sm"
      value={value}
      onChange={(v) => onChange(v as DuracaoUnidade)}
      options={DURACAO_UNIDADES.map((u) => ({ value: u.value, label: u.label }))}
    />
  );
}

/** Esforço por complexidade: processos (.egp) e .sas órfãos — qtd + esforço. */
function ComplexidadeTable({
  rows,
  unidade,
  horasDia,
  diasUteisMes,
}: {
  rows: ComparisonScenario["complexidade"];
  unidade: DuracaoUnidade;
  horasDia: number;
  diasUteisMes: number;
}) {
  const [sel, setSel] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.categoria))
  );
  const toggle = (cat: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });
  const allOn = sel.size === rows.length;
  const toggleAll = () =>
    setSel(allOn ? new Set() : new Set(rows.map((r) => r.categoria)));

  // Totais somam apenas as complexidades marcadas (selecionadas).
  const selRows = rows.filter((r) => sel.has(r.categoria));
  const totEgp = selRows.reduce((a, r) => a + r.n_egp, 0);
  const totHEgp = selRows.reduce((a, r) => a + r.horas_egp, 0);
  const totHEgpMig = selRows.reduce((a, r) => a + r.horas_egp_migrate, 0);
  const totOrf = selRows.reduce((a, r) => a + r.n_orfao, 0);
  const totHOrf = selRows.reduce((a, r) => a + r.horas_orfao, 0);
  const totHOrfMig = selRows.reduce((a, r) => a + r.horas_orfao_migrate, 0);
  // Barras proporcionais ao ESFORÇO MANUAL (a magnitude que importa no comparativo).
  const maxH = Math.max(1, ...rows.map((r) => Math.max(r.horas_egp, r.horas_orfao)));
  // Representatividade: quantidade de cada complexidade sobre o TOTAL (todas as
  // complexidades), separada para .egp e SAS sem EGP. Independe da seleção.
  const totEgpAll = rows.reduce((a, r) => a + r.n_egp, 0);
  const totOrfAll = rows.reduce((a, r) => a + r.n_orfao, 0);
  const pctOf = (n: number, tot: number) => (tot > 0 ? (n / tot) * 100 : 0);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
        <span className="text-[11px] uppercase tracking-wide text-ink-faint">
          Marque as complexidades para somar no total
        </span>
        <button
          onClick={toggleAll}
          className="rounded-lg border border-line bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {allOn ? "Limpar seleção" : "Selecionar tudo"}
        </button>
      </div>
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
              <Icon name="DocumentText" size={14} /> SAS (sem EGP)
            </span>
          </div>

          {rows.map((r, i) => {
            const on = sel.has(r.categoria);
            return (
              <motion.div
                key={r.categoria}
                className="contents"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => toggle(r.categoria)}
                  className={`flex items-center gap-2.5 border-b border-line px-5 py-3 text-left transition-opacity ${
                    on ? "" : "opacity-45"
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                      on
                        ? "border-accent bg-accent text-white"
                        : "border-line bg-black/[0.04]"
                    }`}
                  >
                    {on && <Icon name="TickSquare" size={12} variant="Bold" />}
                  </span>
                  <Badge tone={categoriaTone(r.categoria)}>{r.categoria}</Badge>
                </button>
                <MetricCell
                  qtd={r.n_egp}
                  repr={pctOf(r.n_egp, totEgpAll)}
                  horas={r.horas_egp}
                  horasMig={r.horas_egp_migrate}
                  maxH={maxH}
                  barClass="bg-accent"
                  dim={!on}
                  unidade={unidade}
                  horasDia={horasDia}
                  diasUteisMes={diasUteisMes}
                />
                <MetricCell
                  qtd={r.n_orfao}
                  repr={pctOf(r.n_orfao, totOrfAll)}
                  horas={r.horas_orfao}
                  horasMig={r.horas_orfao_migrate}
                  maxH={maxH}
                  barClass="bg-electric"
                  dim={!on}
                  unidade={unidade}
                  horasDia={horasDia}
                  diasUteisMes={diasUteisMes}
                />
              </motion.div>
            );
          })}

          {/* Totais — somente complexidades selecionadas */}
          <div className="px-5 py-3 text-sm font-bold text-ink">
            Total · {sel.size}/{rows.length}
          </div>
          <TotalCell
            qtd={totEgp}
            repr={pctOf(totEgp, totEgpAll)}
            horas={totHEgp}
            horasMig={totHEgpMig}
            unidade={unidade}
            horasDia={horasDia}
            diasUteisMes={diasUteisMes}
          />
          <TotalCell
            qtd={totOrf}
            repr={pctOf(totOrf, totOrfAll)}
            horas={totHOrf}
            horasMig={totHOrfMig}
            unidade={unidade}
            horasDia={horasDia}
            diasUteisMes={diasUteisMes}
          />
        </div>
      </div>
    </Card>
  );
}

/**
 * Célula com quantidade (destaque) e comparativo de esforço Manual × Migrate:
 * duas barras proporcionais ao mesmo `maxH` (manual sempre ≥ migrate) + % de redução.
 */
function MetricCell({
  qtd,
  repr,
  horas,
  horasMig,
  maxH,
  barClass,
  dim,
  unidade,
  horasDia,
  diasUteisMes,
}: {
  qtd: number;
  repr: number; // % da quantidade sobre o total da coluna (representatividade)
  horas: number;
  horasMig: number;
  maxH: number;
  barClass: string;
  dim?: boolean;
  unidade: DuracaoUnidade;
  horasDia: number;
  diasUteisMes: number;
}) {
  const ganho = horas > 0 ? (1 - horasMig / horas) * 100 : 0;
  return (
    <div
      className={`border-b border-l border-line px-5 py-3 transition-opacity ${
        dim ? "opacity-45" : ""
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-sm font-semibold text-ink">
          {fmtInt(qtd)} un
          <span className="ml-1.5 text-[11px] font-medium text-ink-faint">
            {fmtPct(repr, 1)} do total
          </span>
        </span>
        {horas > 0 && (
          <span className="num text-[11px] font-semibold text-success">
            −{fmtPct(ganho, 0)}
          </span>
        )}
      </div>
      <div className="mt-2 space-y-1.5">
        <EffortBar
          label="Manual"
          horas={horas}
          pct={(horas / maxH) * 100}
          barClass={barClass}
          unidade={unidade}
          horasDia={horasDia}
          diasUteisMes={diasUteisMes}
        />
        <EffortBar
          label="Migrate"
          horas={horasMig}
          pct={(horasMig / maxH) * 100}
          barClass="bg-success"
          unidade={unidade}
          horasDia={horasDia}
          diasUteisMes={diasUteisMes}
        />
      </div>
    </div>
  );
}

/** Linha rotulada (Manual/Migrate) com esforço (na unidade) e barra proporcional. */
function EffortBar({
  label,
  horas,
  pct,
  barClass,
  unidade,
  horasDia,
  diasUteisMes,
}: {
  label: string;
  horas: number;
  pct: number;
  barClass: string;
  unidade: DuracaoUnidade;
  horasDia: number;
  diasUteisMes: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-ink-faint">
          {label}
        </span>
        <span className="num text-xs text-ink-muted">
          {fmtEsforco(horas, unidade, horasDia, diasUteisMes)}
        </span>
      </div>
      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
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

function TotalCell({
  qtd,
  repr,
  horas,
  horasMig,
  unidade,
  horasDia,
  diasUteisMes,
}: {
  qtd: number;
  repr: number; // % da quantidade selecionada sobre o total da coluna
  horas: number;
  horasMig: number;
  unidade: DuracaoUnidade;
  horasDia: number;
  diasUteisMes: number;
}) {
  const ganho = horas > 0 ? (1 - horasMig / horas) * 100 : 0;
  return (
    <div className="border-l border-line px-5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-sm font-bold text-ink">
          {fmtInt(qtd)} un
          <span className="ml-1.5 text-[11px] font-medium text-ink-faint">
            {fmtPct(repr, 1)} do total
          </span>
        </span>
        {horas > 0 && (
          <span className="num text-[11px] font-semibold text-success">
            −{fmtPct(ganho, 0)}
          </span>
        )}
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-faint">
          Manual{" "}
          <span className="num font-semibold text-ink">
            {fmtEsforco(horas, unidade, horasDia, diasUteisMes)}
          </span>
        </span>
        <span className="text-ink-faint">
          Migrate{" "}
          <span className="num font-semibold text-success">
            {fmtEsforco(horasMig, unidade, horasDia, diasUteisMes)}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Comparativo de TEMPO por complexidade: esforço manual ÷ nº de colaboradores do
 * cliente × esforço com Migrate ÷ nº de consultores, separando .egp e .sas órfãos.
 * Checkbox por complexidade alimenta o totalizador de horas (linhas selecionadas).
 */
function ComplexidadeComparativo({
  rows,
  nColab,
  nCons,
  horasDia,
  diasUteisMes,
}: {
  rows: ComparisonScenario["complexidade"];
  nColab: number;
  nCons: number;
  horasDia: number;
  diasUteisMes: number;
}) {
  const [unidade, setUnidade] = useState<DuracaoUnidade>("horas");
  const [sel, setSel] = useState<Set<string>>(
    () => new Set(rows.map((r) => r.categoria))
  );
  const toggle = (cat: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(cat)) n.delete(cat);
      else n.add(cat);
      return n;
    });
  const allOn = sel.size === rows.length;
  const toggleAll = () =>
    setSel(allOn ? new Set() : new Set(rows.map((r) => r.categoria)));

  // Tempo = esforço ÷ nº de pessoas (manual: colaboradores; Migrate: consultores).
  const colab = Math.max(1, nColab);
  const cons = Math.max(1, nCons);
  const selRows = rows.filter((r) => sel.has(r.categoria));
  const totManual =
    selRows.reduce((a, r) => a + r.horas_egp + r.horas_orfao, 0) / colab;
  const totMigrate =
    selRows.reduce((a, r) => a + r.horas_egp_migrate + r.horas_orfao_migrate, 0) /
    cons;
  const economia = totManual - totMigrate;
  const ganhoPct = totManual > 0 ? (economia / totManual) * 100 : 0;

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Tempo por complexidade</h2>
        <div className="flex items-center gap-3">
          <UnidadeSelector value={unidade} onChange={setUnidade} />
          <button
            onClick={toggleAll}
            className="rounded-lg border border-line bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
          >
            {allOn ? "Limpar seleção" : "Selecionar tudo"}
          </button>
        </div>
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Tempo de desenvolvimento = esforço ÷ equipe. Manual ÷{" "}
        <span className="num font-semibold text-ink">{fmtInt(nColab)}</span>{" "}
        colaboradores do cliente · Migrate ÷{" "}
        <span className="num font-semibold text-ink">{fmtInt(nCons)}</span>{" "}
        consultores. Marque as complexidades para somar no totalizador.
      </p>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <div className="grid min-w-[680px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center">
            {/* Cabeçalho */}
            <div className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Complexidade
            </div>
            <HeadCell icon="Hierarchy" titulo=".egp" sub="manual" />
            <HeadCell icon="Hierarchy" titulo=".egp" sub="Migrate" migrate />
            <HeadCell icon="DocumentText" titulo="SAS (sem EGP)" sub="manual" />
            <HeadCell icon="DocumentText" titulo="SAS (sem EGP)" sub="Migrate" migrate />

            {/* Linhas por complexidade */}
            {rows.map((r, i) => {
              const on = sel.has(r.categoria);
              return (
                <motion.div
                  key={r.categoria}
                  className="contents"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <button
                    onClick={() => toggle(r.categoria)}
                    className={`flex items-center gap-2.5 border-b border-line px-4 py-3 text-left transition-opacity ${
                      on ? "" : "opacity-45"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                        on
                          ? "border-accent bg-accent text-white"
                          : "border-line bg-black/[0.04]"
                      }`}
                    >
                      {on && <Icon name="TickSquare" size={12} variant="Bold" />}
                    </span>
                    <Badge tone={categoriaTone(r.categoria)}>{r.categoria}</Badge>
                  </button>
                  <TimeCell
                    horas={r.horas_egp / colab}
                    dim={!on}
                    unidade={unidade}
                    horasDia={horasDia}
                    diasUteisMes={diasUteisMes}
                  />
                  <TimeCell
                    horas={r.horas_egp_migrate / cons}
                    dim={!on}
                    migrate
                    unidade={unidade}
                    horasDia={horasDia}
                    diasUteisMes={diasUteisMes}
                  />
                  <TimeCell
                    horas={r.horas_orfao / colab}
                    dim={!on}
                    unidade={unidade}
                    horasDia={horasDia}
                    diasUteisMes={diasUteisMes}
                  />
                  <TimeCell
                    horas={r.horas_orfao_migrate / cons}
                    dim={!on}
                    migrate
                    unidade={unidade}
                    horasDia={horasDia}
                    diasUteisMes={diasUteisMes}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Totalizador das complexidades selecionadas */}
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <TotalizadorCell
            label={`Manual · ${sel.size}/${rows.length} complexidades`}
            value={fmtEsforco(totManual, unidade, horasDia, diasUteisMes)}
            sub={`÷ ${fmtInt(nColab)} colaboradores`}
          />
          <TotalizadorCell
            label="Com Migrate"
            value={fmtEsforco(totMigrate, unidade, horasDia, diasUteisMes)}
            sub={`÷ ${fmtInt(nCons)} consultores`}
            migrate
          />
          <TotalizadorCell
            label="Economia de tempo"
            value={`−${fmtEsforco(Math.max(0, economia), unidade, horasDia, diasUteisMes)}`}
            sub={`${fmtPct(ganhoPct, 1)} mais rápido`}
            tone="success"
          />
        </div>
      </Card>
    </div>
  );
}

function HeadCell({
  icon,
  titulo,
  sub,
  migrate,
}: {
  icon: string;
  titulo: string;
  sub: string;
  migrate?: boolean;
}) {
  return (
    <div className="border-b border-l border-line px-4 py-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
        <Icon name={icon} size={13} /> {titulo}
      </span>
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide ${
          migrate ? "text-success" : "text-ink-muted"
        }`}
      >
        {sub}
      </span>
    </div>
  );
}

function TimeCell({
  horas,
  dim,
  migrate,
  unidade,
  horasDia,
  diasUteisMes,
}: {
  horas: number;
  dim?: boolean;
  migrate?: boolean;
  unidade: DuracaoUnidade;
  horasDia: number;
  diasUteisMes: number;
}) {
  return (
    <div
      className={`border-b border-l border-line px-4 py-3 transition-opacity ${
        dim ? "opacity-45" : ""
      }`}
    >
      <span
        className={`num text-sm font-semibold ${
          migrate ? "text-success" : "text-ink"
        }`}
      >
        {fmtEsforco(horas, unidade, horasDia, diasUteisMes)}
      </span>
    </div>
  );
}

function TotalizadorCell({
  label,
  value,
  sub,
  migrate,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  migrate?: boolean;
  tone?: "success";
}) {
  const color =
    tone === "success" || migrate ? "text-success" : "text-ink";
  return (
    <div className="bg-base-800 px-5 py-4">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`num mt-1 text-xl font-bold ${color}`}>{value}</p>
      <p className="num mt-0.5 text-xs text-ink-muted">{sub}</p>
    </div>
  );
}

const clampPct = (v: number) =>
  Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 0;

/**
 * Equipe híbrida: consultoria (Migrate) e cliente (manual) atuando EM PARALELO.
 * Por complexidade, o usuário define o % de processos migrados pela consultoria —
 * um % para .egp e outro para .sas órfãos. O restante fica com o cliente (manual).
 * A duração é o gargalo entre as duas frentes (max), pois trabalham juntas.
 */
function EquipeHibrida({
  rows,
  nColab,
  nCons,
  horasDia,
  diasUteisMes,
}: {
  rows: ComparisonScenario["complexidade"];
  nColab: number;
  nCons: number;
  horasDia: number;
  diasUteisMes: number;
}) {
  const [unidade, setUnidade] = useState<DuracaoUnidade>("horas");
  // % migrado pela consultoria por complexidade (.egp e .sas, separados).
  const [pct, setPct] = useState<Record<string, { egp: number; orfao: number }>>(
    () => Object.fromEntries(rows.map((r) => [r.categoria, { egp: 50, orfao: 50 }]))
  );
  const getP = (cat: string, kind: "egp" | "orfao") => pct[cat]?.[kind] ?? 50;
  const setP = (cat: string, kind: "egp" | "orfao", v: number) =>
    setPct((prev) => {
      const cur = prev[cat] ?? { egp: 50, orfao: 50 };
      return { ...prev, [cat]: { ...cur, [kind]: clampPct(v) } };
    });

  const colab = Math.max(1, nColab);
  const cons = Math.max(1, nCons);

  // Esforço dividido entre as frentes (consultoria usa Migrate; cliente, manual).
  let consEffort = 0;
  let cliEffort = 0;
  const perRow = rows.map((r) => {
    const fe = getP(r.categoria, "egp") / 100;
    const fo = getP(r.categoria, "orfao") / 100;
    const rowCons = fe * r.horas_egp_migrate + fo * r.horas_orfao_migrate;
    const rowCli = (1 - fe) * r.horas_egp + (1 - fo) * r.horas_orfao;
    consEffort += rowCons;
    cliEffort += rowCli;
    return { categoria: r.categoria, rowCons, rowCli };
  });

  const consTime = consEffort / cons;
  const cliTime = cliEffort / colab;
  const duracao = Math.max(consTime, cliTime); // frentes em paralelo → gargalo
  const gargalo = consTime >= cliTime ? "consultoria" : "cliente";

  // Linhas de base para comparação: tudo manual (cliente) × tudo Migrate (consultoria).
  const manualEffort = rows.reduce((a, r) => a + r.horas_egp + r.horas_orfao, 0);
  const migEffort = rows.reduce(
    (a, r) => a + r.horas_egp_migrate + r.horas_orfao_migrate,
    0
  );
  const manualTime = manualEffort / colab;
  const migTime = migEffort / cons;

  const maxTime = Math.max(consTime, cliTime, 1);

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Equipe híbrida</h2>
        <div className="flex items-center gap-3">
          <UnidadeSelector value={unidade} onChange={setUnidade} />
          <Badge tone="accent">consultoria + cliente</Badge>
        </div>
      </div>
      <p className="mb-3 text-xs text-ink-muted">
        Simule as duas equipes atuando <span className="font-semibold text-ink">em conjunto</span>:
        uma parte migrada pela <span className="font-semibold text-success">consultoria</span> (com
        Migrate) e o restante pelo <span className="font-semibold text-accent">cliente</span>{" "}
        (manual). Defina, por complexidade, o <span className="font-semibold text-ink">% migrado
        pela consultoria</span> — um para <span className="font-semibold text-ink">.egp</span> e
        outro para <span className="font-semibold text-ink">SAS (sem EGP)</span>. Como as frentes
        trabalham em paralelo, a duração é o gargalo entre elas.
      </p>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <div className="grid min-w-[680px] grid-cols-[1.4fr_1fr_1fr_1fr_1fr] items-center">
            {/* Cabeçalho */}
            <div className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Complexidade
            </div>
            <HeadCell icon="Hierarchy" titulo=".egp" sub="% consultoria" migrate />
            <HeadCell icon="DocumentText" titulo="SAS (sem EGP)" sub="% consultoria" migrate />
            <div className="border-b border-l border-line px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-success">
                Consultoria
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                esforço Migrate
              </span>
            </div>
            <div className="border-b border-l border-line px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                Cliente
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                esforço manual
              </span>
            </div>

            {/* Linhas por complexidade */}
            {rows.map((r, i) => {
              const row = perRow[i];
              return (
                <motion.div
                  key={r.categoria}
                  className="contents"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <div className="flex items-center border-b border-line px-4 py-3">
                    <Badge tone={categoriaTone(r.categoria)}>{r.categoria}</Badge>
                  </div>
                  <PctCell
                    value={getP(r.categoria, "egp")}
                    onChange={(v) => setP(r.categoria, "egp", v)}
                  />
                  <PctCell
                    value={getP(r.categoria, "orfao")}
                    onChange={(v) => setP(r.categoria, "orfao", v)}
                  />
                  <TimeCell
                    horas={row.rowCons}
                    migrate
                    unidade={unidade}
                    horasDia={horasDia}
                    diasUteisMes={diasUteisMes}
                  />
                  <TimeCell
                    horas={row.rowCli}
                    unidade={unidade}
                    horasDia={horasDia}
                    diasUteisMes={diasUteisMes}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Duração em paralelo: barras das duas frentes + gargalo */}
        <div className="border-t border-line px-5 py-4">
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-[11px] uppercase tracking-wide text-ink-faint">
              Duração das frentes (em paralelo)
            </span>
            <span className="num text-sm font-bold text-ink">
              {fmtEsforco(duracao, unidade, horasDia, diasUteisMes)}
              <span className="ml-1 text-xs font-medium text-ink-muted">
                limitada pela {gargalo}
              </span>
            </span>
          </div>
          <ParallelBar
            label={`Consultoria · ÷ ${fmtInt(nCons)} consultores`}
            horas={consTime}
            pct={(consTime / maxTime) * 100}
            barClass="bg-success"
            valueClass="text-success"
            unidade={unidade}
            horasDia={horasDia}
            diasUteisMes={diasUteisMes}
          />
          <ParallelBar
            label={`Cliente · ÷ ${fmtInt(nColab)} colaboradores`}
            horas={cliTime}
            pct={(cliTime / maxTime) * 100}
            barClass="bg-accent"
            valueClass="text-accent"
            unidade={unidade}
            horasDia={horasDia}
            diasUteisMes={diasUteisMes}
          />
        </div>

        {/* Comparação: híbrido × tudo manual × tudo Migrate */}
        <div className="grid gap-px bg-line sm:grid-cols-3">
          <TotalizadorCell
            label="Híbrido (em paralelo)"
            value={fmtEsforco(duracao, unidade, horasDia, diasUteisMes)}
            sub={`gargalo: ${gargalo}`}
            tone="success"
          />
          <TotalizadorCell
            label="Tudo pelo cliente (manual)"
            value={fmtEsforco(manualTime, unidade, horasDia, diasUteisMes)}
            sub={`÷ ${fmtInt(nColab)} colaboradores`}
          />
          <TotalizadorCell
            label="Tudo pela consultoria (Migrate)"
            value={fmtEsforco(migTime, unidade, horasDia, diasUteisMes)}
            sub={`÷ ${fmtInt(nCons)} consultores`}
            migrate
          />
        </div>
      </Card>
    </div>
  );
}

/** Célula com input editável de porcentagem (0–100), alinhada à direita. */
function PctCell({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="border-b border-l border-line px-4 py-3">
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="num w-16 rounded-lg border border-line bg-black/[0.04] px-2 py-1 text-sm font-semibold text-ink outline-none transition-colors focus:border-accent"
        />
        <span className="text-xs text-ink-faint">%</span>
      </div>
    </div>
  );
}

/** Barra de uma frente (consultoria/cliente) proporcional ao tempo, com rótulo. */
function ParallelBar({
  label,
  horas,
  pct,
  barClass,
  valueClass,
  unidade,
  horasDia,
  diasUteisMes,
}: {
  label: string;
  horas: number;
  pct: number;
  barClass: string;
  valueClass: string;
  unidade: DuracaoUnidade;
  horasDia: number;
  diasUteisMes: number;
}) {
  return (
    <div className="mt-2 first:mt-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-ink-muted">{label}</span>
        <span className={`num text-xs font-semibold ${valueClass}`}>
          {fmtEsforco(horas, unidade, horasDia, diasUteisMes)}
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]">
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
