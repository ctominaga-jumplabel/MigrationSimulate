# === ARQUIVO GERADO por frontend/scripts/build_engine.py — NÃO EDITE ===
# Fonte canônica: core.py. Edite lá e rode o script de novo.
# -*- coding: utf-8 -*-
"""
core.py — Motor de cálculo do Simulador de Esforço (Migração SAS -> Databricks).

Camada de NÚCLEO (AIOS.md §12): funções PURAS, sem dependência de Streamlit.
Recebem DataFrames + `params` e devolvem números/objetos testáveis.

Convenções (IDEACAO_SIMULADOR.md §4, NEXT_STEPS.md):
    - Esforço por .sas = `horas_estimadas` da planilha (NUNCA recalculado aqui).
    - Esforço por EGP (Job no Databricks) = Σ horas_sas + (J_base + J_task × n_sas).
    - K multiplica o esforço TOTAL (e, por consistência com os sprints, o `horas`
      de cada item da fila). K reflete a proficiência da equipe (metodologia §7):
      0.8 sênior · 1.0 padrão · 1.3 time novo em SAS.
    - Duração: homem-hora é fixo; mais consultores reduzem DURAÇÃO, não ESFORÇO.
    - Sprint = 10 dias úteis; capacidade = n_consultores × horas_dia × 10.
"""
from __future__ import annotations

import datetime as _dt
import math

import pandas as pd

# Ordem canônica das categorias (do mais simples ao mais complexo).
CATEGORIA_ORDER = ["Trivial", "Simples", "Médio", "Complexo", "Muito Complexo"]

# Ganho padrão da ferramenta Migrate (MigrateMind) por categoria de complexidade:
# % de REDUÇÃO do esforço de CONVERSÃO de código .sas. Como o Migrate também gera
# os Jobs no Databricks, este mesmo ganho reduz o overhead de Job — porém de forma
# PONDERADA pela complexidade dos .sas de cada EGP (ver `_job_overhead_migrate`).
# Calibragem de partida a partir de testes de campo — código trivial/simples chega
# a >90% de ganho (a conversão é quase toda automática); código muito complexo
# exige mais revisão/reparo manual, logo ganho menor. Ajustável na app (tela de
# calibração). Consumido por `compute_migrate`; a API expõe estes defaults.
MIGRATE_GAIN_DEFAULT = {
    "Trivial": 92.0,
    "Simples": 90.0,
    "Médio": 85.0,
    "Complexo": 80.0,
    "Muito Complexo": 80.0,
}

DATASET_PATH = "data/dataset.parquet"
ROLLUP_PATH = "data/egp_rollup.parquet"

# Dias úteis por sprint (IDEACAO §4 / AIOS §12).
DIAS_POR_SPRINT = 10

# Conversões de duração (apresentação no comparativo): a partir de DIAS ÚTEIS.
# `dias_uteis_mes` é uma alavanca (default 21 dias úteis/mês); o ano = 12 meses
# (= dias_uteis_mes × 12, p.ex. 21 → 252 dias úteis/ano). Usado por
# `compute_comparison`/`_duracao_breakdown`.
DIAS_UTEIS_POR_MES = 21.0
MESES_POR_ANO = 12.0


# ---------------------------------------------------------------------------
# Carregamento dos parquet (read-only). O cache (st.cache_data) fica em app.py.
# ---------------------------------------------------------------------------
def load_parquets(
    dataset_path: str = DATASET_PATH, rollup_path: str = ROLLUP_PATH
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Lê os dois parquet gerados na Fase 0. Insumos read-only."""
    dataset_df = pd.read_parquet(dataset_path)
    rollup_df = pd.read_parquet(rollup_path)
    return dataset_df, rollup_df


# ---------------------------------------------------------------------------
# Agregações da UI (puras; antes em app.py).
# ---------------------------------------------------------------------------
def overview_metrics(dataset_df: pd.DataFrame) -> dict:
    """KPIs descritivos da Visão Geral (a partir do dataset, nível-arquivo).

    Retorna dict com:
        - "bruto": todas as linhas.
        - "sem_dup_arquivo": recorte nível-ARQUIVO (`is_likely_duplicate==False`),
          SEM colapso de famílias. ATENÇÃO: este NÃO é o cenário "Sem duplicatas"
          oficial da app — o oficial é por-família (canônico) e vem de
          `compute_scenarios`/`canonical_rollup`. Mantido só como nota/caption
          ("nível-arquivo"); nunca exibir como KPI de esforço Sem-dup.

    Pura, sem Streamlit.
    """
    df = dataset_df
    sem_dup_arquivo = df[~df["is_likely_duplicate"]]

    def _bloco(frame: pd.DataFrame) -> dict:
        return {
            "horas_totais": float(frame["horas_estimadas"].sum()),
            "n_egps": int(frame["egp_name"].dropna().nunique()),
            "n_orfaos": int(frame["is_orphan"].sum()),
            "n_sas": int(len(frame)),
            "n_pipeline_family": int(frame["pipeline_family"].dropna().nunique()),
        }

    return {"bruto": _bloco(df), "sem_dup_arquivo": _bloco(sem_dup_arquivo)}


def categoria_distribution(dataset_df: pd.DataFrame) -> pd.DataFrame:
    """Distribuição por `categoria`: contagem de .sas e soma de horas.

    DataFrame com colunas categoria, n_sas, soma_horas — ordenado por
    CATEGORIA_ORDER. Pura, sem Streamlit.
    """
    agg = (
        dataset_df.groupby("categoria", dropna=False)
        .agg(n_sas=("file_name", "size"), soma_horas=("horas_estimadas", "sum"))
        .reset_index()
    )
    agg["categoria"] = pd.Categorical(
        agg["categoria"], categories=CATEGORIA_ORDER, ordered=True
    )
    agg = agg.sort_values("categoria").reset_index(drop=True)
    agg["soma_horas"] = agg["soma_horas"].astype(float)
    agg["n_sas"] = agg["n_sas"].astype(int)
    return agg


def job_overhead(n_sas, params: dict):
    """Overhead de Job por EGP: `J_base + J_task × n_sas`.

    Vetorizada (aceita escalar ou Series/array). Sem Streamlit.
    """
    return params["J_base"] + params["J_task"] * n_sas


def egp_table(rollup_df: pd.DataFrame, params: dict, cenario: str) -> pd.DataFrame:
    """Uma linha por EGP com horas dos .sas, horas de Job e total.

    Cenário "bruto" usa `soma_horas_sas`/`n_sas` em TODOS os EGPs. Cenário
    "sem_dup" usa as colunas `*_sem_dup` e opera SÓ sobre os EGPs canônicos por
    `pipeline_family` (via `canonical_rollup`) — alinhado à definição oficial de
    Sem-dup em `compute_scenarios`. Ordena por `horas_total` desc. Pura.

    Reconciliação (Quality Gate §9): em "sem_dup", Σ horas_total desta tabela ==
    horas_sas (EGPs canônicos) + horas_job de `scenarios['sem_dup']`. Somando os
    órfãos Sem-dup chega-se ao esforço Sem-dup total (sem K).
    """
    is_sem_dup = cenario == "sem_dup"
    horas_col = "soma_horas_sas_sem_dup" if is_sem_dup else "soma_horas_sas"
    n_col = "n_sas_sem_dup" if is_sem_dup else "n_sas"

    # Sem-dup oficial: só os EGPs canônicos de cada família carregam Job/horas.
    src = canonical_rollup(rollup_df) if is_sem_dup else rollup_df

    out = pd.DataFrame(
        {
            "egp_name": src["egp_name"].to_numpy(),
            "n_sas": src[n_col].astype(int).to_numpy(),
            "horas_sas": src[horas_col].astype(float).to_numpy(),
            "categoria_predominante": src["categoria_predominante"].to_numpy(),
        }
    )
    out["horas_job"] = job_overhead(out["n_sas"], params).astype(float)
    out["horas_total"] = out["horas_sas"] + out["horas_job"]
    out = out.sort_values("horas_total", ascending=False).reset_index(drop=True)
    return out[
        [
            "egp_name",
            "n_sas",
            "horas_sas",
            "horas_job",
            "horas_total",
            "categoria_predominante",
        ]
    ]


def sas_children(dataset_df: pd.DataFrame, egp_name: str) -> pd.DataFrame:
    """Os .sas filhos de um EGP, ordenados por horas desc. Pura."""
    child = dataset_df[dataset_df["egp_name"] == egp_name]
    out = child[
        ["file_name", "categoria", "horas_estimadas", "is_likely_duplicate"]
    ].copy()
    out = out.sort_values("horas_estimadas", ascending=False).reset_index(drop=True)
    return out


def orphan_table(dataset_df: pd.DataFrame, cenario: str) -> pd.DataFrame:
    """Uma linha por `.sas` órfão. "bruto" = todos; "sem_dup" = não-duplicatas.

    Colunas file_name, categoria, horas_estimadas, ordenadas por horas desc. Pura.
    """
    orphans = dataset_df[dataset_df["is_orphan"] == True]  # noqa: E712
    if cenario == "sem_dup":
        orphans = orphans[~orphans["is_likely_duplicate"]]
    out = orphans[["file_name", "categoria", "horas_estimadas"]].copy()
    out["horas_estimadas"] = out["horas_estimadas"].astype(float)
    out = out.sort_values("horas_estimadas", ascending=False).reset_index(drop=True)
    return out


# ---------------------------------------------------------------------------
# MOTOR DE CÁLCULO (Fase 4).
# ---------------------------------------------------------------------------
def canonical_rollup(rollup_df: pd.DataFrame) -> pd.DataFrame:
    """Seleciona o EGP canônico de cada `pipeline_family` (Sem-dup por família).

    Canônico = o de maior `soma_horas_sas` na família (empate → primeiro por
    ordem estável da tabela). EGPs com `pipeline_family` nula/única são sua
    própria família e entram. Só o canônico carrega 1 Job por família e usa as
    colunas `*_sem_dup`. Os não-canônicos são descartados do cenário Sem-dup.

    Esta é a ÚNICA definição de "Sem duplicatas" em toda a app (por-família):
    consumida tanto por `compute_scenarios` (KPIs/esforço) quanto por `egp_table`
    (aba EGPs). O número file-level (`is_likely_duplicate==False`) NÃO é "o"
    Sem-dup — ver `overview_metrics` (`sem_dup_arquivo`).
    """
    # idxmax preserva o primeiro em caso de empate (ordem estável do DataFrame).
    # Famílias nulas são preservadas (dropna=False) — cada uma é a própria família.
    idx = (
        rollup_df.reset_index(drop=True)
        .groupby("pipeline_family", dropna=False, sort=False)["soma_horas_sas"]
        .idxmax()
    )
    return rollup_df.reset_index(drop=True).loc[idx].reset_index(drop=True)


# Alias privado mantido por compatibilidade interna.
_canonical_rollup = canonical_rollup


def _split_prioridades(
    prioridades: dict | None,
) -> tuple[dict | None, dict | None]:
    """Normaliza o argumento `prioridades` de `compute_scenarios`.

    Aceita dois formatos e devolve `(prio_bruto, prio_sem_dup)`:
        - Por cenário: `{"bruto": {...}, "sem_dup": {...}}` — usa cada sub-dict no
          seu cenário (chaves ausentes viram None).
        - Achatado: `{("egp"|"orfao", nome): prioridade_int}` — o MESMO dict é
          aplicado a ambos os cenários.
        - None → (None, None).
    """
    if not prioridades:
        return None, None
    # Por-cenário se as chaves de topo são exatamente os nomes dos cenários.
    if set(prioridades.keys()) <= {"bruto", "sem_dup"}:
        return prioridades.get("bruto"), prioridades.get("sem_dup")
    # Caso contrário: dict achatado aplicado a ambos.
    return prioridades, prioridades


def _itens_fila(
    egp_rows: pd.DataFrame,
    orphan_rows: pd.DataFrame,
    K: float,
    prioridades: dict | None = None,
) -> pd.DataFrame:
    """Monta a fila unificada (EGPs + órfãos) com K já aplicado por item.

    `egp_rows`: DataFrame com colunas nome, horas_sas, horas_job.
    `orphan_rows`: DataFrame com colunas nome, horas (horas_estimadas).

    Ordenação (prioridade efetiva 1..N):
        - Sem `prioridades`: default por esforço — maior `horas` primeiro.
        - Com `prioridades` (dict `{("egp"|"orfao", nome): prioridade_int}`):
          ordena pela prioridade do usuário (ascendente). Itens AUSENTES do dict
          caem para o fim (recebem +infinito), mantendo o default por esforço
          (`horas` desc) como desempate dentro de cada grupo. Pura/testável.
    """
    egp_part = pd.DataFrame(
        {
            "tipo": "egp",
            "nome": egp_rows["nome"].to_numpy(),
            "horas": (egp_rows["horas_sas"].to_numpy() + egp_rows["horas_job"].to_numpy())
            * K,
        }
    )
    orphan_part = pd.DataFrame(
        {
            "tipo": "orfao",
            "nome": orphan_rows["nome"].to_numpy(),
            "horas": orphan_rows["horas"].to_numpy() * K,
        }
    )
    itens = pd.concat([egp_part, orphan_part], ignore_index=True)
    itens["horas"] = itens["horas"].astype(float)

    if prioridades:
        # Prioridade efetiva do usuário; faltantes vão para o fim (+inf).
        itens["_prio"] = [
            float(prioridades.get((t, n), math.inf))
            for t, n in zip(itens["tipo"], itens["nome"])
        ]
        # Ordena por (prioridade asc, horas desc). Desempate por esforço mantém
        # o default; faltantes (prio=+inf) ficam no fim, ordenados por horas desc.
        itens = itens.sort_values(
            ["_prio", "horas"], ascending=[True, False], kind="stable"
        ).reset_index(drop=True)
        itens = itens.drop(columns="_prio")
    else:
        itens = itens.sort_values("horas", ascending=False, kind="stable").reset_index(
            drop=True
        )

    itens.insert(0, "prioridade", range(1, len(itens) + 1))
    return itens[["prioridade", "tipo", "nome", "horas"]]


def _cenario_dict(
    horas_sas: float,
    horas_job: float,
    itens: pd.DataFrame,
    n_egps: int,
    n_orfaos: int,
    params: dict,
) -> dict:
    """Monta o dict de saída de um cenário a partir dos componentes."""
    return {
        **_effort_metrics(horas_sas, horas_job, params),
        "n_egps": int(n_egps),
        "n_orfaos": int(n_orfaos),
        "itens": itens,
    }


def _effort_metrics(horas_sas: float, horas_job: float, params: dict) -> dict:
    """Métricas escalares de esforço/duração a partir de horas .sas + Job.

    Núcleo do cálculo de um cenário, SEM contagens nem fila (`itens`): esforço
    base (sas + job), esforço total (×K), duração (dias úteis e horas por
    consultor) e nº de sprints. Reutilizado por `_cenario_dict` (cenários Bruto /
    Sem-dup) e por `compute_migrate` (cenário com a ferramenta Migrate), para que
    o ganho do Migrate use EXATAMENTE a mesma fórmula de duração/sprints.
    """
    K = float(params["K"])
    esforco_base = horas_sas + horas_job  # antes de K (sas + job)
    esforco_total = esforco_base * K
    capacidade_dia = params["n_consultores"] * params["horas_dia"]
    # Duração em dias úteis = person-hours ÷ capacidade diária da equipe
    # (n_consultores × horas_dia). NÃO dividir de novo por horas_dia (bug antigo).
    duracao_dias_uteis = (
        esforco_total / capacidade_dia if capacidade_dia else float("inf")
    )
    # `duracao_horas` = esforço POR CONSULTOR (horas que cada um trabalha ao longo
    # do projeto) = duracao_dias_uteis × horas_dia. Coerente com a duração em dias.
    duracao_horas = (
        duracao_dias_uteis * params["horas_dia"]
        if duracao_dias_uteis != float("inf")
        else float("inf")
    )
    capacidade_sprint = capacidade_dia * DIAS_POR_SPRINT
    n_sprints = (
        int(math.ceil(esforco_total / capacidade_sprint)) if capacidade_sprint else 0
    )
    return {
        "horas_sas": float(horas_sas),
        "horas_job": float(horas_job),
        "esforco_base": float(esforco_base),
        "K": K,
        "esforco_total": float(esforco_total),
        "duracao_horas": float(duracao_horas),
        "duracao_dias_uteis": float(duracao_dias_uteis),
        "n_sprints": int(n_sprints),
    }


def compute_scenarios(
    dataset_df: pd.DataFrame,
    rollup_df: pd.DataFrame,
    params: dict,
    prioridades: dict | None = None,
) -> dict:
    """Motor central: esforço, duração e fila de itens para Bruto e Sem-dup.

    Retorna {"bruto": {...}, "sem_dup": {...}}. Cada cenário tem (ver docstring
    do módulo e NEXT_STEPS): horas_sas, horas_job, esforco_base, K, esforco_total,
    duracao_horas, duracao_dias_uteis, n_sprints, n_egps, n_orfaos, itens.

    Regras:
        - Bruto: TODOS os EGPs (cada um com horas_sas=soma_horas_sas e
          horas_job=J_base+J_task×n_sas) + TODOS os órfãos (horas_estimadas; órfão
          não tem job overhead).
        - Sem-dup (por família): só o EGP canônico de cada `pipeline_family` entra
          (1 Job por família), usando soma_horas_sas_sem_dup e n_sas_sem_dup.
          Órfãos Sem-dup = só is_likely_duplicate==False.
        - K multiplica o esforço total e o `horas` de cada item da fila.

    `prioridades` (opcional): override de prioridade por cenário no formato
        {("bruto"|"sem_dup"): {("egp"|"orfao", nome): prioridade_int}} OU,
        para conveniência, um único dict {("egp"|"orfao", nome): prioridade_int}
        aplicado a AMBOS os cenários. Quando fornecido, a fila `itens` é ordenada
        pela prioridade do usuário (faltantes ao fim, default por esforço como
        desempate). Sem override: comportamento atual (default por esforço).
    """
    K = float(params["K"])
    prio_bruto, prio_semdup = _split_prioridades(prioridades)

    # --- BRUTO -------------------------------------------------------------
    egp_bruto = pd.DataFrame(
        {
            "nome": rollup_df["egp_name"].to_numpy(),
            "horas_sas": rollup_df["soma_horas_sas"].astype(float).to_numpy(),
            "horas_job": job_overhead(rollup_df["n_sas"], params).astype(float).to_numpy(),
        }
    )
    orphans_bruto = orphan_table(dataset_df, "bruto").rename(
        columns={"file_name": "nome", "horas_estimadas": "horas"}
    )

    horas_sas_bruto = float(egp_bruto["horas_sas"].sum())
    horas_job_bruto = float(egp_bruto["horas_job"].sum())
    horas_orfaos_bruto = float(orphans_bruto["horas"].sum())
    itens_bruto = _itens_fila(
        egp_bruto, orphans_bruto[["nome", "horas"]], K, prioridades=prio_bruto
    )

    bruto = _cenario_dict(
        horas_sas=horas_sas_bruto + horas_orfaos_bruto,  # esforço .sas inclui órfãos
        horas_job=horas_job_bruto,
        itens=itens_bruto,
        n_egps=int(len(egp_bruto)),
        n_orfaos=int(len(orphans_bruto)),
        params=params,
    )

    # --- SEM-DUP (por família) --------------------------------------------
    canon = canonical_rollup(rollup_df)
    egp_semdup = pd.DataFrame(
        {
            "nome": canon["egp_name"].to_numpy(),
            "horas_sas": canon["soma_horas_sas_sem_dup"].astype(float).to_numpy(),
            "horas_job": job_overhead(canon["n_sas_sem_dup"], params)
            .astype(float)
            .to_numpy(),
        }
    )
    orphans_semdup = orphan_table(dataset_df, "sem_dup").rename(
        columns={"file_name": "nome", "horas_estimadas": "horas"}
    )

    horas_sas_semdup = float(egp_semdup["horas_sas"].sum())
    horas_job_semdup = float(egp_semdup["horas_job"].sum())
    horas_orfaos_semdup = float(orphans_semdup["horas"].sum())
    itens_semdup = _itens_fila(
        egp_semdup, orphans_semdup[["nome", "horas"]], K, prioridades=prio_semdup
    )

    sem_dup = _cenario_dict(
        horas_sas=horas_sas_semdup + horas_orfaos_semdup,
        horas_job=horas_job_semdup,
        itens=itens_semdup,
        n_egps=int(len(egp_semdup)),
        n_orfaos=int(len(orphans_semdup)),
        params=params,
    )

    return {"bruto": bruto, "sem_dup": sem_dup}


# ---------------------------------------------------------------------------
# CENÁRIO COM A FERRAMENTA MIGRATE (MigrateMind).
# ---------------------------------------------------------------------------
def categoria_breakdown(
    dataset_df: pd.DataFrame, rollup_df: pd.DataFrame, cenario: str
) -> pd.DataFrame:
    """Horas de CONVERSÃO .sas por categoria de complexidade, para um cenário.

    Decompõe o `horas_sas` do cenário (o componente de conversão de código, que
    inclui os órfãos) por `categoria`, de forma RECONCILIÁVEL com
    `compute_scenarios`:

        - "bruto": todos os `.sas` (Σ horas_estimadas == horas_sas Bruto).
        - "sem_dup": os `.sas` que sobrevivem ao colapso por família —
          não-duplicatas dentro dos EGPs canônicos + órfãos não-duplicatas
          (Σ == horas_sas Sem-dup, antes de K).

    Colunas: categoria, n_sas, horas_sas — ordenadas por CATEGORIA_ORDER. Pura.
    O overhead de Job NÃO entra aqui — ele é reduzido à parte, por EGP e ponderado
    pela complexidade, em `_job_overhead_migrate`.
    """
    if cenario == "sem_dup":
        canon = set(canonical_rollup(rollup_df)["egp_name"].tolist())
        nao_dup = ~dataset_df["is_likely_duplicate"]
        em_canonico = dataset_df["egp_name"].isin(canon) & nao_dup
        orfao_nao_dup = (dataset_df["is_orphan"] == True) & nao_dup  # noqa: E712
        df = dataset_df[em_canonico | orfao_nao_dup]
    elif cenario == "bruto":
        df = dataset_df
    else:
        raise ValueError(f"cenário inválido: {cenario!r}")

    agg = (
        df.groupby("categoria", dropna=False)
        .agg(n_sas=("file_name", "size"), horas_sas=("horas_estimadas", "sum"))
        .reset_index()
    )
    agg["categoria"] = pd.Categorical(
        agg["categoria"], categories=CATEGORIA_ORDER, ordered=True
    )
    agg = agg.sort_values("categoria").reset_index(drop=True)
    agg["horas_sas"] = agg["horas_sas"].astype(float)
    agg["n_sas"] = agg["n_sas"].astype(int)
    return agg


def _merge_gain(gain_map: dict | None) -> dict:
    """Mescla o ganho informado sobre os defaults (categorias ausentes → default)."""
    merged = dict(MIGRATE_GAIN_DEFAULT)
    if gain_map:
        for cat, pct in gain_map.items():
            if pct is not None:
                # Clampa em [0, 100]: ganho é % de redução do esforço de conversão.
                merged[cat] = max(0.0, min(100.0, float(pct)))
    return merged


def _job_overhead_migrate_by_egp(
    dataset_df: pd.DataFrame,
    rollup_df: pd.DataFrame,
    params: dict,
    gain: dict,
    cenario: str,
) -> pd.DataFrame:
    """Overhead de Job COM o ganho do Migrate, POR EGP.

    O Migrate gera os Jobs no Databricks, então o ganho também reduz o overhead de
    orquestração — mas de forma PONDERADA pela complexidade dos `.sas` de cada EGP
    (um EGP só de código trivial tem o Job quase todo automatizado; um de código
    muito complexo, bem menos). Por EGP:

        g_egp = Σ_cat (n_sas_cat × ganho_cat) / n_sas_egp     (média ponderada)
        job_migrate_egp = (J_base + J_task × n_sas_egp) × (1 − g_egp/100)

    A ponderação é por CONTAGEM de `.sas` (o overhead J_task escala com `n_sas`),
    sobre o MESMO conjunto de `.sas` que define `n_sas` do cenário em
    `compute_scenarios` (todos no Bruto; só não-duplicatas de EGP canônico no
    Sem-dup). Órfãos não têm Job e não entram. Retorna um DataFrame com colunas
    egp_name, horas_job_migrate (base do total `_job_overhead_migrate` e da coluna
    de Job migrado em `egp_migrate_table`). Pura.
    """
    # `n_sas` autoritativo por EGP — o MESMO usado no overhead de compute_scenarios.
    if cenario == "sem_dup":
        canon = canonical_rollup(rollup_df)
        egp_n = canon[["egp_name", "n_sas_sem_dup"]].rename(
            columns={"n_sas_sem_dup": "n_sas"}
        )
        canon_set = set(canon["egp_name"].tolist())
        nao_dup = ~dataset_df["is_likely_duplicate"]
        nao_orfao = dataset_df["is_orphan"] == False  # noqa: E712
        df = dataset_df[dataset_df["egp_name"].isin(canon_set) & nao_dup & nao_orfao]
    elif cenario == "bruto":
        egp_n = rollup_df[["egp_name", "n_sas"]].copy()
        df = dataset_df[dataset_df["is_orphan"] == False]  # noqa: E712
    else:
        raise ValueError(f"cenário inválido: {cenario!r}")

    # Ganho ponderado por EGP: soma do ganho de cada .sas ÷ nº de .sas do EGP.
    df = df.assign(_g=df["categoria"].map(lambda c: float(gain.get(c, 0.0))))
    por_egp = (
        df.groupby("egp_name", dropna=False)
        .agg(soma_g=("_g", "sum"), n=("_g", "size"))
        .reset_index()
    )
    por_egp["g_egp"] = por_egp["soma_g"] / por_egp["n"].where(por_egp["n"] > 0, 1)

    merged = egp_n.merge(por_egp[["egp_name", "g_egp"]], on="egp_name", how="left")
    merged["g_egp"] = merged["g_egp"].fillna(0.0)
    job = job_overhead(merged["n_sas"].astype(float), params)
    merged["horas_job_migrate"] = (job * (1.0 - merged["g_egp"] / 100.0)).astype(float)
    return merged[["egp_name", "horas_job_migrate"]]


def _job_overhead_migrate(
    dataset_df: pd.DataFrame,
    rollup_df: pd.DataFrame,
    params: dict,
    gain: dict,
    cenario: str,
) -> float:
    """Overhead de Job TOTAL do cenário COM o ganho do Migrate (Σ sobre os EGPs).

    Soma de `_job_overhead_migrate_by_egp` — ver lá a derivação do ganho ponderado
    por EGP. Mantido como API estável de `compute_migrate`. Pura."""
    by_egp = _job_overhead_migrate_by_egp(dataset_df, rollup_df, params, gain, cenario)
    return float(by_egp["horas_job_migrate"].sum())


def egp_migrate_table(
    dataset_df: pd.DataFrame,
    rollup_df: pd.DataFrame,
    params: dict,
    cenario: str,
    gain_map: dict | None = None,
) -> pd.DataFrame:
    """`egp_table` + colunas COM Migrate por EGP — comparação a nível de código.

    Acrescenta `horas_sas_migrate`, `horas_job_migrate` e `horas_total_migrate` a
    cada EGP. O ganho incide por `.sas` (pela sua categoria) na conversão e, no
    Job, ponderado pela complexidade dos `.sas` do EGP (mesma regra de
    `compute_migrate`/`_job_overhead_migrate_by_egp`).

    Reconciliável (Quality Gate §9): Σ horas_job_migrate == `_job_overhead_migrate`
    do cenário; Σ horas_sas_migrate (EGPs) + Σ (órfãos reduzidos por categoria) ==
    `compute_migrate[cen]['migrate']['horas_sas']`. Pura, sem Streamlit.
    """
    gain = _merge_gain(gain_map)
    base = egp_table(rollup_df, params, cenario)

    # Mesmo conjunto de `.sas` (não-órfãos) que define n_sas/horas_sas do cenário.
    if cenario == "sem_dup":
        canon_set = set(canonical_rollup(rollup_df)["egp_name"].tolist())
        nao_dup = ~dataset_df["is_likely_duplicate"]
        nao_orfao = dataset_df["is_orphan"] == False  # noqa: E712
        sub = dataset_df[dataset_df["egp_name"].isin(canon_set) & nao_dup & nao_orfao]
    elif cenario == "bruto":
        sub = dataset_df[dataset_df["is_orphan"] == False]  # noqa: E712
    else:
        raise ValueError(f"cenário inválido: {cenario!r}")

    # Conversão `.sas` reduzida por categoria, somada por EGP.
    g = sub["categoria"].map(lambda c: float(gain.get(c, 0.0)))
    h_mig = sub["horas_estimadas"].astype(float) * (1.0 - g / 100.0)
    sas_mig = h_mig.groupby(sub["egp_name"], dropna=False).sum()
    base["horas_sas_migrate"] = base["egp_name"].map(sas_mig).fillna(0.0).astype(float)

    # Overhead de Job reduzido (ponderado por complexidade), do mesmo motor.
    job_by_egp = _job_overhead_migrate_by_egp(
        dataset_df, rollup_df, params, gain, cenario
    )
    job_map = dict(zip(job_by_egp["egp_name"], job_by_egp["horas_job_migrate"]))
    base["horas_job_migrate"] = base["egp_name"].map(job_map).fillna(0.0).astype(float)
    base["horas_total_migrate"] = base["horas_sas_migrate"] + base["horas_job_migrate"]
    return base


def compute_migrate(
    dataset_df: pd.DataFrame,
    rollup_df: pd.DataFrame,
    params: dict,
    gain_map: dict | None = None,
) -> dict:
    """Esforço/tempo de desenvolvimento COM a ferramenta Migrate (MigrateMind).

    O ganho do Migrate é uma % de REDUÇÃO do esforço de CONVERSÃO de código
    `.sas`, aplicada POR CATEGORIA de complexidade (`gain_map`, defaults em
    `MIGRATE_GAIN_DEFAULT`). Como o Migrate também GERA os Jobs no Databricks, o
    mesmo ganho reduz o overhead de Job — mas ponderado pela complexidade dos
    `.sas` de cada EGP (ver `_job_overhead_migrate`), não na proporção total. As
    demais alavancas (K, nº de consultores, horas/dia) valem igual, então duração e
    nº de sprints saem da MESMA fórmula (`_effort_metrics`) — mudam o `horas_sas` e
    o `horas_job`, ambos agora reduzidos.

    Retorna `{"bruto": {...}, "sem_dup": {...}}`. Cada cenário tem:
        - manual: KPIs SEM Migrate (espelham `compute_scenarios`, sem a fila).
        - migrate: KPIs COM Migrate (horas_sas reduzido por categoria).
        - economia_horas / ganho_pct: redução do esforço TOTAL (×K) manual→Migrate.
        - n_egps, n_orfaos: contexto do cenário (iguais ao manual).
        - por_categoria: lista de dicts {categoria, n_sas, horas_manual,
          horas_migrate, ganho_pct, economia_horas} — o ganho efetivo POR
          complexidade, base da tela de calibração.

    `gain_map` (opcional): {categoria: pct_reducao 0..100}. Mesclado sobre os
    defaults; valores fora de [0,100] são clampados. Pura, sem Streamlit.
    """
    gain = _merge_gain(gain_map)
    scen = compute_scenarios(dataset_df, rollup_df, params)
    out: dict = {}

    for cenario in ("bruto", "sem_dup"):
        manual = scen[cenario]
        # Overhead de Job COM Migrate: reduzido por EGP, ponderado por complexidade.
        horas_job_migrate = _job_overhead_migrate(
            dataset_df, rollup_df, params, gain, cenario
        )
        K = float(params["K"])

        bd = categoria_breakdown(dataset_df, rollup_df, cenario)
        por_categoria = []
        horas_sas_migrate = 0.0
        for _, r in bd.iterrows():
            cat = r["categoria"]
            g = float(gain.get(cat, 0.0))
            h_manual = float(r["horas_sas"])
            h_migrate = h_manual * (1.0 - g / 100.0)
            horas_sas_migrate += h_migrate
            por_categoria.append(
                {
                    "categoria": cat,
                    "n_sas": int(r["n_sas"]),
                    "ganho_pct": g,
                    "horas_manual": h_manual,
                    "horas_migrate": h_migrate,
                    "economia_horas": h_manual - h_migrate,
                }
            )

        migrate_kpis = _effort_metrics(horas_sas_migrate, horas_job_migrate, params)
        manual_kpis = {
            k: manual[k]
            for k in (
                "horas_sas",
                "horas_job",
                "esforco_base",
                "K",
                "esforco_total",
                "duracao_horas",
                "duracao_dias_uteis",
                "n_sprints",
            )
        }
        economia = manual_kpis["esforco_total"] - migrate_kpis["esforco_total"]
        ganho_pct = (
            economia / manual_kpis["esforco_total"] * 100.0
            if manual_kpis["esforco_total"] > 0
            else 0.0
        )

        out[cenario] = {
            "manual": manual_kpis,
            "migrate": migrate_kpis,
            "economia_horas": float(economia),
            "ganho_pct": float(ganho_pct),
            "n_egps": int(manual["n_egps"]),
            "n_orfaos": int(manual["n_orfaos"]),
            "por_categoria": por_categoria,
        }

    return out


# ---------------------------------------------------------------------------
# COMPARATIVO POR COMPLEXIDADE (tela "Comparativo"): migração MANUAL pelo cliente
# (nº de COLABORADORES do cliente) × migração com a ferramenta MIGRATE conduzida
# pelos CONSULTORES. Sem cálculo novo de esforço — reaproveita compute_migrate; a
# única conta adicional é traduzir o MESMO esforço (horas trabalhadas, fixo) em DURAÇÃO
# de calendário sob equipes de tamanhos diferentes (cliente × consultores).
# ---------------------------------------------------------------------------
def _duracao_breakdown(
    esforco_total: float,
    n_pessoas: float,
    horas_dia: float,
    dias_uteis_mes: float = DIAS_UTEIS_POR_MES,
) -> dict:
    """Traduz um esforço total (horas trabalhadas) em duração, dado o tamanho da equipe.

    O esforço (horas trabalhadas) é FIXO; o tamanho da equipe só muda a DURAÇÃO. Devolve
    a mesma duração expressa em horas (úteis de calendário), DIAS ÚTEIS, meses e
    anos — coerente com `_effort_metrics` (dias úteis = esforço ÷ capacidade/dia).
    Meses e anos consideram só DIAS ÚTEIS: 1 mês = `dias_uteis_mes` dias úteis
    (alavanca, default 21) e 1 ano = 12 meses. Pura: equipe nula → durações infinitas.
    """
    capacidade_dia = float(n_pessoas) * float(horas_dia)
    dias = esforco_total / capacidade_dia if capacidade_dia else float("inf")
    finita = dias != float("inf")
    dum = float(dias_uteis_mes) if dias_uteis_mes else DIAS_UTEIS_POR_MES
    return {
        "esforco_total": float(esforco_total),  # horas trabalhadas (independe da equipe)
        "n_pessoas": int(n_pessoas),
        # Duração de calendário em horas úteis = dias úteis × h/dia (= esforço ÷ pessoas).
        "duracao_horas": float(dias * horas_dia) if finita else float("inf"),
        "duracao_dias": float(dias),
        "duracao_meses": float(dias / dum) if finita else float("inf"),
        "duracao_anos": float(dias / (dum * MESES_POR_ANO)) if finita else float("inf"),
    }


def _complexidade_breakdown(
    dataset_df: pd.DataFrame,
    rollup_df: pd.DataFrame,
    params: dict,
    cenario: str,
    gain: dict,
) -> list[dict]:
    """Escopo por complexidade: processos (.egp) e `.sas` ÓRFÃOS, SEPARADOS.

    Decompõe o esforço do cenário em duas parcelas disjuntas e somáveis
    (quantidade + esforço MANUAL e esforço COM MIGRATE, com K já aplicado):

        - .egp (processo): por `categoria_predominante`. Esforço do EGP = conversão
          dos seus `.sas` + overhead de Job (J_base + J_task × n_sas); a versão
          Migrate reduz conversão (por categoria do .sas) e Job (ponderado pela
          complexidade) — agregada de `egp_migrate_table`. "sem_dup" usa só os EGPs
          canônicos por família.
        - .sas ÓRFÃO: arquivos `.sas` que NÃO pertencem a nenhum EGP, por
          `categoria` própria (sem Job); Migrate reduz pela % da categoria.
          "sem_dup" = só não-duplicatas.

    Reconciliação: Σ esforço manual (.egp + órfãos) == esforço manual do cenário;
    Σ esforço Migrate (.egp + órfãos) == esforço com Migrate do cenário. Pura.
    """
    K = float(params["K"])

    # --- Processos (.egp): manual + Migrate, por categoria predominante ----
    egp_tbl = egp_migrate_table(dataset_df, rollup_df, params, cenario, gain_map=gain)
    egp_g = egp_tbl.groupby("categoria_predominante", dropna=False).agg(
        n=("horas_total", "size"),
        horas=("horas_total", "sum"),
        horas_migrate=("horas_total_migrate", "sum"),
    )

    # --- .sas órfãos: manual + Migrate, por categoria própria (sem Job) ----
    orph = orphan_table(dataset_df, cenario)  # file_name, categoria, horas_estimadas
    g_orf = orph["categoria"].map(lambda c: float(gain.get(c, 0.0)))
    orph = orph.assign(
        horas_migrate=orph["horas_estimadas"].astype(float) * (1.0 - g_orf / 100.0)
    )
    orph_g = orph.groupby("categoria", dropna=False).agg(
        n=("horas_estimadas", "size"),
        horas=("horas_estimadas", "sum"),
        horas_migrate=("horas_migrate", "sum"),
    )

    rows: list[dict] = []
    for cat in CATEGORIA_ORDER:
        rows.append(
            {
                "categoria": cat,
                "n_egp": int(egp_g["n"].get(cat, 0)),
                "horas_egp": float(egp_g["horas"].get(cat, 0.0)) * K,
                "horas_egp_migrate": float(egp_g["horas_migrate"].get(cat, 0.0)) * K,
                "n_orfao": int(orph_g["n"].get(cat, 0)),
                "horas_orfao": float(orph_g["horas"].get(cat, 0.0)) * K,
                "horas_orfao_migrate": float(orph_g["horas_migrate"].get(cat, 0.0)) * K,
            }
        )
    return rows


def compute_comparison(
    dataset_df: pd.DataFrame,
    rollup_df: pd.DataFrame,
    params: dict,
    gain_map: dict | None = None,
) -> dict:
    """Comparativo por complexidade: cliente (manual) × consultores (com Migrate).

    Reaproveita `compute_migrate` (esforço manual e esforço com Migrate, ambos já
    com K) e apenas traduz cada esforço em DURAÇÃO sob equipes distintas:

        - MANUAL: conduzida pelo CLIENTE com `n_colaboradores` pessoas.
        - MIGRATE: conduzida pelos CONSULTORES com `n_consultores` pessoas.

    `params["n_colaboradores"]` (nº de colaboradores do cliente); se ausente, cai
    para `n_consultores`. Cada lado traz a duração em horas/dias/meses/anos
    (`_duracao_breakdown`). A `complexidade` lista, por categoria, a quantidade
    TOTAL de processos (.egp) e de arquivos (.sas) do cenário — `.egp` por
    `categoria_predominante`, `.sas` por `categoria` (reconciliável com
    `categoria_breakdown`). Retorna `{"bruto": {...}, "sem_dup": {...}}`. Pura.
    """
    gain = _merge_gain(gain_map)
    mig = compute_migrate(dataset_df, rollup_df, params, gain_map=gain_map)
    n_consultores = int(params["n_consultores"])
    n_colaboradores = int(params.get("n_colaboradores", n_consultores))
    horas_dia = float(params["horas_dia"])
    dias_uteis_mes = float(params.get("dias_uteis_mes", DIAS_UTEIS_POR_MES))

    out: dict = {}
    for cenario in ("bruto", "sem_dup"):
        m = mig[cenario]
        manual_eff = float(m["manual"]["esforco_total"])
        migrate_eff = float(m["migrate"]["esforco_total"])

        # Escopo por complexidade: processos (.egp, por categoria predominante) e
        # .sas ÓRFÃOS (por categoria), com quantidade E esforço (×K). Disjuntos e
        # somáveis: Σ(esforço .egp + esforço órfãos) == esforço manual do cenário.
        complexidade = _complexidade_breakdown(
            dataset_df, rollup_df, params, cenario, gain
        )

        economia = manual_eff - migrate_eff
        ganho_pct = economia / manual_eff * 100.0 if manual_eff > 0 else 0.0

        out[cenario] = {
            "manual": _duracao_breakdown(
                manual_eff, n_colaboradores, horas_dia, dias_uteis_mes
            ),
            "migrate": _duracao_breakdown(
                migrate_eff, n_consultores, horas_dia, dias_uteis_mes
            ),
            "economia_horas": float(economia),
            "ganho_pct": float(ganho_pct),
            "n_colaboradores": int(n_colaboradores),
            "n_consultores": int(n_consultores),
            "n_egps": int(m["n_egps"]),
            "n_orfaos": int(m["n_orfaos"]),
            "complexidade": complexidade,
        }

    return out


# ---------------------------------------------------------------------------
# EMPACOTAMENTO EM SPRINTS (Fase 4: motor; UI completa na Fase 5).
# ---------------------------------------------------------------------------
def _sprint_dates(
    data_inicio: _dt.date, sprint_idx: int, dias: int = DIAS_POR_SPRINT
) -> tuple[_dt.date, _dt.date]:
    """Datas (início, fim) do sprint `sprint_idx` (1..S), `dias` úteis cada,
    pulando fins de semana, a partir de `data_inicio`. v1: sem feriados."""
    # Avança até o início do sprint pedido: (sprint_idx-1)*dias dias úteis.
    skip = (sprint_idx - 1) * dias
    cur = data_inicio
    # Garante que o ponto de partida é dia útil.
    while cur.weekday() >= 5:
        cur += _dt.timedelta(days=1)
    contados = 0
    while contados < skip:
        cur += _dt.timedelta(days=1)
        if cur.weekday() < 5:
            contados += 1
    while cur.weekday() >= 5:
        cur += _dt.timedelta(days=1)
    inicio = cur
    # Avança `dias` dias úteis (inclusive o de início) para achar o fim.
    uteis = 1
    fim = inicio
    while uteis < dias:
        fim += _dt.timedelta(days=1)
        if fim.weekday() < 5:
            uteis += 1
    return inicio, fim


def pack_sprints(itens_df: pd.DataFrame, params: dict) -> dict:
    """Empacota a fila de itens em sprints (greedy por prioridade asc).

    Capacidade por sprint = n_consultores × horas_dia × 10. Um item pode
    atravessar sprints (as horas são divididas). Pura, sem Streamlit.

    Retorna:
        - "alocacao": DataFrame por item com prioridade, tipo, nome, horas,
          sprint_inicial, sprint_final.
        - "resumo_sprints": DataFrame por sprint com sprint, data_inicio,
          data_fim, horas_alocadas, capacidade, itens_no_sprint (contagem).

    Garante Σ horas_alocadas dos sprints == Σ horas da fila (tolerância flutuante).
    """
    capacidade = params["n_consultores"] * params["horas_dia"] * DIAS_POR_SPRINT
    data_inicio = params["data_inicio"]

    itens = itens_df.sort_values("prioridade", kind="stable").reset_index(drop=True)

    aloc_rows = []
    # Horas alocadas por sprint (dict sprint_num -> horas) e contagem de itens.
    sprint_horas: dict[int, float] = {}
    sprint_itens: dict[int, int] = {}

    # Capacidade nula (n_consultores=0 ou horas_dia=0): cenário degenerado.
    # Unificado com `_cenario_dict`/`n_sprints` → ambos resultam em 0 sprints
    # (não há capacidade para agendar). A UI tem mínimo 1 consultor, então isto
    # só ocorre em testes/uso programático. Retorna alocação e resumo vazios.
    if capacidade <= 0:
        alocacao_vazia = pd.DataFrame(
            columns=[
                "prioridade",
                "tipo",
                "nome",
                "horas",
                "sprint_inicial",
                "sprint_final",
            ]
        )
        resumo_vazio = pd.DataFrame(
            columns=[
                "sprint",
                "data_inicio",
                "data_fim",
                "horas_alocadas",
                "capacidade",
                "itens_no_sprint",
            ]
        )
        return {"alocacao": alocacao_vazia, "resumo_sprints": resumo_vazio}

    sprint_atual = 1
    restante_no_sprint = float(capacidade)

    for _, row in itens.iterrows():
        horas_item = float(row["horas"])
        sprint_inicial = sprint_atual
        toca_sprint = set()

        if horas_item == 0:
            # Item de 0 horas ocupa o sprint atual sem consumir capacidade.
            sprint_horas.setdefault(sprint_atual, 0.0)
            toca_sprint.add(sprint_atual)
            sprint_final = sprint_atual
        else:
            falta = horas_item
            while falta > 1e-9:
                if restante_no_sprint <= 1e-9:
                    sprint_atual += 1
                    restante_no_sprint = float(capacidade)
                aloca = min(falta, restante_no_sprint)
                sprint_horas[sprint_atual] = sprint_horas.get(sprint_atual, 0.0) + aloca
                toca_sprint.add(sprint_atual)
                falta -= aloca
                restante_no_sprint -= aloca
            sprint_final = sprint_atual

        for s in toca_sprint:
            sprint_itens[s] = sprint_itens.get(s, 0) + 1

        aloc_rows.append(
            {
                "prioridade": int(row["prioridade"]),
                "tipo": row["tipo"],
                "nome": row["nome"],
                "horas": horas_item,
                "sprint_inicial": int(sprint_inicial),
                "sprint_final": int(sprint_final),
            }
        )

    alocacao = pd.DataFrame(
        aloc_rows,
        columns=[
            "prioridade",
            "tipo",
            "nome",
            "horas",
            "sprint_inicial",
            "sprint_final",
        ],
    )

    # Resumo por sprint (1..S, contíguo).
    n_sprints = max(sprint_horas.keys()) if sprint_horas else 0
    resumo_rows = []
    for s in range(1, n_sprints + 1):
        ini, fim = _sprint_dates(data_inicio, s)
        resumo_rows.append(
            {
                "sprint": s,
                "data_inicio": ini,
                "data_fim": fim,
                "horas_alocadas": float(sprint_horas.get(s, 0.0)),
                "capacidade": float(capacidade),
                "itens_no_sprint": int(sprint_itens.get(s, 0)),
            }
        )
    resumo_sprints = pd.DataFrame(
        resumo_rows,
        columns=[
            "sprint",
            "data_inicio",
            "data_fim",
            "horas_alocadas",
            "capacidade",
            "itens_no_sprint",
        ],
    )

    return {"alocacao": alocacao, "resumo_sprints": resumo_sprints}


# ---------------------------------------------------------------------------
# EXPORT (Fase 6): abas reconciliáveis do plano para um cenário.
# ---------------------------------------------------------------------------
def build_export(
    dataset_df: pd.DataFrame,
    rollup_df: pd.DataFrame,
    params: dict,
    prioridades: dict | None = None,
) -> dict[str, pd.DataFrame]:
    """Monta as abas de export do plano para UM cenário. Pura, sem Streamlit.

    O cenário exportado vem de `params["cenario_export"]` (`"bruto"` ou
    `"sem_dup"`; default `"bruto"`). Reaproveita o motor (`compute_scenarios`,
    `pack_sprints`, `egp_table`, `orphan_table`) — nada de cálculo novo aqui,
    apenas reorganização para planilha. A prioridade (`prioridades`) e as
    alavancas em `params` são respeitadas via `compute_scenarios`.

    Retorna um dict de DataFrames (uma aba cada):
        - "egps": tabela de EGPs do cenário (prioridade efetiva, horas .sas,
          horas Job, total, sprints de início/fim).
        - "orfaos": `.sas` órfãos do cenário (prioridade efetiva, horas, sprint).
        - "resumo_sprints": por sprint (datas, horas alocadas, capacidade,
          % ocupação, nº itens).
        - "alocacao": fila item→sprint (prioridade, tipo, nome, horas ×K,
          sprint inicial/final).
    """
    cenario = params.get("cenario_export", "bruto")
    if cenario not in ("bruto", "sem_dup"):
        raise ValueError(f"cenario_export inválido: {cenario!r}")

    scenarios = compute_scenarios(dataset_df, rollup_df, params, prioridades=prioridades)
    cen = scenarios[cenario]
    packed = pack_sprints(cen["itens"], params)
    alocacao = packed["alocacao"]
    resumo = packed["resumo_sprints"].copy()

    # % de ocupação por sprint (coerente com a UI da aba Sprints).
    if len(resumo):
        resumo["ocupacao_pct"] = (
            resumo["horas_alocadas"] / resumo["capacidade"] * 100.0
        ).where(resumo["capacidade"] > 0, 0.0)
    else:
        resumo["ocupacao_pct"] = pd.Series(dtype=float)

    # Mapas item->sprint (a partir da alocação) para anexar às abas egps/orfaos.
    spr_ini = {(t, n): s for t, n, s in zip(
        alocacao["tipo"], alocacao["nome"], alocacao["sprint_inicial"]
    )}
    spr_fim = {(t, n): s for t, n, s in zip(
        alocacao["tipo"], alocacao["nome"], alocacao["sprint_final"]
    )}
    # Prioridade efetiva da fila (1..N) para anexar às abas egps/orfaos.
    prio_fila = {(t, n): p for t, n, p in zip(
        cen["itens"]["tipo"], cen["itens"]["nome"], cen["itens"]["prioridade"]
    )}

    # --- aba egps ----------------------------------------------------------
    egps = egp_table(rollup_df, params, cenario).copy()
    egps.insert(0, "prioridade", [
        int(prio_fila.get(("egp", nome), 0)) for nome in egps["egp_name"]
    ])
    egps["sprint_inicial"] = [
        int(spr_ini.get(("egp", nome), 0)) for nome in egps["egp_name"]
    ]
    egps["sprint_final"] = [
        int(spr_fim.get(("egp", nome), 0)) for nome in egps["egp_name"]
    ]
    egps = egps.sort_values("prioridade", kind="stable").reset_index(drop=True)

    # --- aba orfaos --------------------------------------------------------
    orfaos = orphan_table(dataset_df, cenario).copy()
    orfaos.insert(0, "prioridade", [
        int(prio_fila.get(("orfao", nome), 0)) for nome in orfaos["file_name"]
    ])
    orfaos["sprint_inicial"] = [
        int(spr_ini.get(("orfao", nome), 0)) for nome in orfaos["file_name"]
    ]
    orfaos["sprint_final"] = [
        int(spr_fim.get(("orfao", nome), 0)) for nome in orfaos["file_name"]
    ]
    orfaos = orfaos.sort_values("prioridade", kind="stable").reset_index(drop=True)

    return {
        "egps": egps,
        "orfaos": orfaos,
        "resumo_sprints": resumo,
        "alocacao": alocacao,
    }
