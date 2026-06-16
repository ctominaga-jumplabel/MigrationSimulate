"use client";

import { useScenarios, useParams } from "@/lib/hooks";
import { useSim } from "@/lib/store";
import { fmtHoras } from "@/lib/format";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Icon } from "./Icon";
import { MobileNav } from "./MobileNav";

/** Barra superior: cenário GLOBAL + status de cálculo ao vivo. */
export function Topbar() {
  const cenario = useSim((s) => s.cenario);
  const setCenario = useSim((s) => s.setCenario);
  const params = useParams();
  const { data, isFetching } = useScenarios(params);
  const active = data?.[cenario];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-line bg-base-900/60 px-6 py-3 backdrop-blur-xl">
      <div className="flex items-center gap-3">
        <MobileNav />
        <span className="text-xs font-medium text-ink-muted">Cenário ativo</span>
        <SegmentedControl
          size="sm"
          value={cenario}
          onChange={(v) => setCenario(v)}
          options={[
            { value: "bruto", label: "Bruto" },
            { value: "sem_dup", label: "Sem duplicatas" },
          ]}
        />
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden items-center gap-2 text-sm md:flex">
          <Icon name="Flash" size={16} variant="Bold" className="text-accent-soft" />
          <span className="text-ink-muted">Esforço total</span>
          <span className="num font-bold text-ink">
            {active ? fmtHoras(active.esforco_total) : "—"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full transition-colors ${
              isFetching ? "animate-pulse bg-warn" : "bg-success"
            }`}
          />
          <span className="text-xs text-ink-muted">
            {isFetching ? "recalculando…" : "ao vivo"}
          </span>
        </div>
      </div>
    </header>
  );
}
