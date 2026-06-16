// Estado global das alavancas + cenário ativo + prioridades editadas.
// Apenas guarda parâmetros; TODO cálculo vem da API (core.py).
"use client";

import { create } from "zustand";
import type { Cenario, Params, PrioridadeItem } from "./types";

interface SimState {
  n_consultores: number;
  horas_dia: number;
  J_base: number;
  J_task: number;
  K: number;
  data_inicio: string;
  cenario: Cenario;
  // Prioridades editadas por cenário (chave = `${tipo}:${nome}`).
  prioridades: Record<Cenario, Record<string, number>>;

  set: (patch: Partial<SimState>) => void;
  setCenario: (c: Cenario) => void;
  setPrioridade: (c: Cenario, tipo: "egp" | "orfao", nome: string, p: number) => void;
  reset: () => void;
  params: () => Params;
}

const DEFAULTS = {
  n_consultores: 5,
  horas_dia: 6,
  J_base: 8,
  J_task: 2,
  K: 1.0,
  data_inicio: "2026-06-15",
  cenario: "bruto" as Cenario,
};

export const useSim = create<SimState>((set, get) => ({
  ...DEFAULTS,
  prioridades: { bruto: {}, sem_dup: {} },

  set: (patch) => set(patch),
  setCenario: (cenario) => set({ cenario }),
  setPrioridade: (c, tipo, nome, p) =>
    set((s) => ({
      prioridades: {
        ...s.prioridades,
        [c]: { ...s.prioridades[c], [`${tipo}:${nome}`]: p },
      },
    })),
  reset: () => set({ ...DEFAULTS, prioridades: { bruto: {}, sem_dup: {} } }),

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
      horas_dia: s.horas_dia,
      J_base: s.J_base,
      J_task: s.J_task,
      K: s.K,
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
