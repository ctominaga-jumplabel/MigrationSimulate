# === ARQUIVO GERADO por frontend/scripts/build_engine.py — NÃO EDITE ===
# Fonte canônica: api/models.py. Edite lá e rode o script de novo.
# -*- coding: utf-8 -*-
"""Modelos Pydantic da API fina (camada de transporte, sem cálculo).

Espelham o `params` que `core.compute_scenarios`/`pack_sprints`/`build_export`
esperam (AIOS §12). A conversão para os tipos que o `core` usa (date, dict de
prioridades com chave tupla) é feita aqui — o `core` permanece puro.
"""
from __future__ import annotations

import datetime as _dt
from typing import Literal

from pydantic import BaseModel, Field

Cenario = Literal["bruto", "sem_dup"]


class PrioridadeItem(BaseModel):
    """Override de prioridade de um item da fila (EGP ou órfão)."""

    tipo: Literal["egp", "orfao"]
    nome: str
    prioridade: int


class Params(BaseModel):
    """Alavancas da simulação (IDEACAO §4). Defaults = números oficiais da v1."""

    n_consultores: int = Field(default=5, ge=1, le=200)
    # Colaboradores do CLIENTE (equipe que faria a migração MANUAL). Usado pelo
    # comparativo por complexidade; até 200 pessoas. Default = nº de consultores.
    n_colaboradores: int = Field(default=5, ge=1, le=200)
    horas_dia: float = Field(default=6.0, gt=0, le=24)
    J_base: float = Field(default=8.0, ge=0)
    J_task: float = Field(default=2.0, ge=0)
    K: float = Field(default=1.0, gt=0)
    # Dias úteis por mês (comparativo: conversão horas→meses/anos). Default 21;
    # ano = 12 meses. Só apresentação de duração — não altera esforço/sprints.
    dias_uteis_mes: float = Field(default=21.0, gt=0, le=31)
    data_inicio: _dt.date = Field(default_factory=lambda: _dt.date(2026, 6, 15))
    cenario: Cenario = "bruto"
    prioridades: list[PrioridadeItem] = Field(default_factory=list)

    def core_params(self) -> dict:
        """Converte para o dict `params` que o `core` consome."""
        return {
            "n_consultores": self.n_consultores,
            "n_colaboradores": self.n_colaboradores,
            "horas_dia": self.horas_dia,
            "J_base": self.J_base,
            "J_task": self.J_task,
            "K": self.K,
            "dias_uteis_mes": self.dias_uteis_mes,
            "data_inicio": self.data_inicio,
            "cenario": self.cenario,
            "cenario_export": self.cenario,
        }

    def core_prioridades(self) -> dict | None:
        """Monta o override de prioridade no formato por-cenário do `core`.

        `core.compute_scenarios` aceita `{"bruto"|"sem_dup": {(tipo, nome): int}}`.
        Aplicamos os overrides SÓ ao cenário ativo (espelha o Streamlit, onde a
        prioridade é persistida por cenário).
        """
        if not self.prioridades:
            return None
        flat = {(p.tipo, p.nome): int(p.prioridade) for p in self.prioridades}
        return {self.cenario: flat}


class MigrateRequest(Params):
    """Alavancas + ganho do Migrate por categoria (para `core.compute_migrate`).

    `migrate_gain` é um mapa {categoria: % de redução do esforço de conversão
    .sas (0..100)}. Categorias ausentes herdam `core.MIGRATE_GAIN_DEFAULT`; o
    `core` clampa em [0,100]. Herda todas as alavancas de `Params` (K, consultores
    etc.), que valem igual no cenário com Migrate.
    """

    migrate_gain: dict[str, float] = Field(default_factory=dict)

    def core_gain(self) -> dict:
        """Mapa de ganho no formato que `core.compute_migrate` consome."""
        return {str(k): float(v) for k, v in self.migrate_gain.items()}


class EgpChildrenRequest(BaseModel):
    egp_name: str
