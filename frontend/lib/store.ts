// Estado global das alavancas + cenário ativo + prioridades editadas.
// Apenas guarda parâmetros; TODO cálculo vem da API (core.py).
"use client";

import { create } from "zustand";
import type { Cenario, Params, PrioridadeItem } from "./types";

interface SimState {
  n_consultores: number;
  n_colaboradores: number;
  horas_dia: number;
  J_base: number;
  J_task: number;
  K: number;
  dias_uteis_mes: number;
  data_inicio: string;
  cenario: Cenario;
  // Prioridades editadas por cenário (chave = `${tipo}:${nome}`).
  prioridades: Record<Cenario, Record<string, number>>;
  // Ganho do Migrate por categoria de complexidade (% de redução da conversão).
  migrate_gain: Record<string, number>;

  set: (patch: Partial<SimState>) => void;
  setCenario: (c: Cenario) => void;
  setPrioridade: (c: Cenario, tipo: "egp" | "orfao", nome: string, p: number) => void;
  setMigrateGain: (categoria: string, pct: number) => void;
  resetMigrateGain: () => void;
  reset: () => void;
  params: () => Params;
}

// Defaults espelham core.MIGRATE_GAIN_DEFAULT (a UI parte coerente mesmo antes
// de o /api/catalog carregar; a tela de calibração permite sobrescrever).
export const MIGRATE_GAIN_DEFAULTS: Record<string, number> = {
  Trivial: 92,
  Simples: 90,
  Médio: 85,
  Complexo: 80,
  "Muito Complexo": 80,
};

const DEFAULTS = {
  n_consultores: 5,
  n_colaboradores: 50,
  horas_dia: 6,
  J_base: 8,
  J_task: 2,
  K: 1.0,
  dias_uteis_mes: 21,
  data_inicio: "2026-06-15",
  cenario: "bruto" as Cenario,
};

export const useSim = create<SimState>((set, get) => ({
  ...DEFAULTS,
  prioridades: { bruto: {}, sem_dup: {} },
  migrate_gain: { ...MIGRATE_GAIN_DEFAULTS },

  set: (patch) => set(patch),
  setCenario: (cenario) => set({ cenario }),
  setPrioridade: (c, tipo, nome, p) =>
    set((s) => ({
      prioridades: {
        ...s.prioridades,
        [c]: { ...s.prioridades[c], [`${tipo}:${nome}`]: p },
      },
    })),
  setMigrateGain: (categoria, pct) =>
    set((s) => ({
      migrate_gain: {
        ...s.migrate_gain,
        [categoria]: Math.max(0, Math.min(100, pct)),
      },
    })),
  resetMigrateGain: () => set({ migrate_gain: { ...MIGRATE_GAIN_DEFAULTS } }),
  reset: () =>
    set({
      ...DEFAULTS,
      prioridades: { bruto: {}, sem_dup: {} },
      migrate_gain: { ...MIGRATE_GAIN_DEFAULTS },
    }),

  params: () => {
    const s = get();
    const prio = s.prioridades[s.cenario] ?? {};
    const prioridades: PrioridadeItem[] = Object.entries(prio).map(
      ([key, prioridade]) => {
        const [tipo, ...rest] = key.split(":");
        return {
          tipo: tipo as "egp" | "orfao",
          nome: rest.join(":"),
          prioridade,
        };
      }
    );
    return {
      n_consultores: s.n_consultores,
      n_colaboradores: s.n_colaboradores,
      horas_dia: s.horas_dia,
      J_base: s.J_base,
      J_task: s.J_task,
      K: s.K,
      dias_uteis_mes: s.dias_uteis_mes,
      data_inicio: s.data_inicio,
      cenario: s.cenario,
      prioridades,
    };
  },
}));

// Selector estável das alavancas (para chaves de query / deps).
export function paramsKey(p: Params): string {
  return JSON.stringify(p);
}
