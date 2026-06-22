# -*- coding: utf-8 -*-
"""egp_complexity.py — Reavaliação de complexidade dos EGPs (processos).

Aplica a MESMA metodologia de avaliação dos `.sas` (METODOLOGIA_AVALIACAO_SAS.md,
dimensões D1–D7) ao EGP inteiro, tratado como a SOMATÓRIA de todos os `.sas`
dentro dele — em vez da antiga `categoria_predominante` (moda das categorias dos
filhos), que classificava como "Trivial" um EGP feito de 200 arquivos triviais.

Regra de agregação (equivale a avaliar o EGP como se fosse um único arquivo = a
concatenação de todos os seus `.sas`):
  - CONTAGENS somam: LOC efetivas, comentários, DATA+PROC steps, macros definidas,
    chamadas de macro, pontos de D4 (manipulação) e D6 (integrações), if/then,
    select/when, do-loops, hardcoded paths, magic numbers.
  - PROFUNDIDADES de aninhamento (macro, DO) viram o MÁXIMO entre os filhos
    (arquivos separados não aninham um no outro).
  - FLAGS (goto/link, name literal, %if+%do em macro) viram OR.
  - comment_ratio do EGP = Σ comentários / Σ LOC efetivas.
Depois aplica os MESMOS scorers de dimensão (`avaliar_sas.score_D1..D7`), os
MESMOS pesos (`WEIGHTS`) e a MESMA categorização (`interpolate_hours`).

Reaproveita `avaliar_sas` (regexes + scoring) — não reimplementa a metodologia.
Produz, por EGP e por cenário, a categoria e o score ponderado:
  - Bruto:   todos os `.sas` do EGP.
  - Sem-dup: só os `.sas` com `is_likely_duplicate == False` (alinhado às colunas
             `*_sem_dup` do rollup). EGP sem nenhum não-duplicata → None.

O conjunto de `.sas` e a flag de duplicata vêm do `dataset` (verdade da planilha);
os métricos brutos vêm de reparsear o arquivo on-disk apontado por `file_path`.
Chamado por `prepare_data.build_rollup` e mesclado em `egp_rollup.parquet`.
"""
from __future__ import annotations

import os
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pandas as pd

import avaliar_sas as av

BASE_DIR = Path(__file__).resolve().parent

# Teto de processos no reparse. Cada worker (spawn no Windows) reimporta o módulo
# __main__ → pandas/numpy; muitos simultâneos estouram o arquivo de paginação.
# Tetar em ~4 mantém o uso de memória estável (workers não acumulam) ao custo de
# alguns minutos a mais — é um passo de ETL pontual.
_MAX_WORKERS_CAP = 4

# Métricas brutas agregáveis por EGP e como cada uma combina entre os filhos.
# (chave_no_dict_evaluate_file, modo) — modo: "sum" | "max" | "or".
_SUM_FIELDS = {
    "loc_effective": "loc_effective",
    "loc_comment": "loc_comment",
    "n_data_steps": "n_data_steps",
    "n_proc_steps": "n_proc_steps",
    "n_macros_defined": "n_macros_defined",
    "n_macro_calls": "n_macro_calls",
    "_d4_points": "d4_points",
    "_d6_points": "d6_points",
    "n_if_then": "n_if_then",
    "n_select_when": "n_select_when",
    "n_do_loops": "n_do_loops",
    "n_hardcoded_paths": "n_hardcoded_paths",
    "_n_magic_numbers": "n_magic_numbers",
}
_MAX_FIELDS = {
    "macro_nesting_depth": "macro_nesting_depth",
    "max_do_nesting": "max_do_nesting",
}
_OR_FIELDS = {
    "has_goto_link": "has_goto_link",
    "_has_name_literal": "has_name_literal",
    "_has_macro_if_and_do": "has_macro_if_and_do",
}


def _parse_one(file_path: str) -> dict | None:
    """Reparsea UM `.sas` (caminho relativo ao repo) e devolve só os métricos
    brutos necessários à agregação. None se o arquivo não existir/parsear."""
    abs_path = BASE_DIR / file_path
    try:
        m = av.evaluate_file(abs_path, file_path)
    except (OSError, ValueError):
        return None
    out = {"file_path": file_path}
    for src, dst in _SUM_FIELDS.items():
        out[dst] = m[src]
    for src, dst in _MAX_FIELDS.items():
        out[dst] = m[src]
    for src, dst in _OR_FIELDS.items():
        out[dst] = bool(m[src])
    return out


def _score_from_agg(a: dict) -> tuple[float, str]:
    """Aplica D1–D7 (avaliar_sas) sobre métricas JÁ agregadas → (score, categoria).

    `a` traz as somas/máximos/ORs de um EGP (ou subconjunto). Usa os mesmos
    scorers, pesos e categorização dos `.sas` (metodologia §2/§3/§4)."""
    loc_eff = int(a["loc_effective"])
    comment_ratio = (a["loc_comment"] / loc_eff) if loc_eff > 0 else 0.0

    d1 = av.score_D1(loc_eff)
    d2 = av.score_D2(int(a["n_data_steps"]), int(a["n_proc_steps"]))
    d3 = av.score_D3(
        int(a["n_macros_defined"]),
        int(a["n_macro_calls"]),
        bool(a["has_macro_if_and_do"]),
        int(a["macro_nesting_depth"]),
    )
    # D4/D6: as faixas operam sobre PONTOS; somamos os pontos dos filhos e
    # reaplicamos a faixa (equivale a pontuar o EGP concatenado).
    d4 = _band_d4(int(a["d4_points"]))
    d5 = av.score_D5(
        int(a["n_if_then"]),
        int(a["n_select_when"]),
        int(a["n_do_loops"]),
        bool(a["has_goto_link"]),
        int(a["max_do_nesting"]),
    )
    d6 = _band_d6(int(a["d6_points"]))
    d7 = av.score_D7(
        comment_ratio,
        int(a["n_hardcoded_paths"]),
        int(a["n_magic_numbers"]),
        bool(a["has_name_literal"]),
    )

    score = (
        d1 * av.WEIGHTS["D1"] + d2 * av.WEIGHTS["D2"] + d3 * av.WEIGHTS["D3"]
        + d4 * av.WEIGHTS["D4"] + d5 * av.WEIGHTS["D5"] + d6 * av.WEIGHTS["D6"]
        + d7 * av.WEIGHTS["D7"]
    )
    score = round(score, 4)
    categoria, _, _, _ = av.interpolate_hours(score)
    return score, categoria


def _band_d4(points: int) -> int:
    """Faixa de score (1–5) de D4 a partir dos PONTOS somados (metodologia §D4)."""
    if points <= 2:
        return 1
    if points <= 6:
        return 2
    if points <= 15:
        return 3
    if points <= 30:
        return 4
    return 5


def _band_d6(points: int) -> int:
    """Faixa de score (1–5) de D6 a partir dos PONTOS somados (metodologia §D6)."""
    if points <= 1:
        return 1
    if points <= 4:
        return 2
    if points <= 10:
        return 3
    if points <= 20:
        return 4
    return 5


def _aggregate(metrics: pd.DataFrame) -> dict:
    """Agrega as métricas brutas de um grupo de `.sas` (sum/max/or)."""
    a: dict = {}
    for dst in _SUM_FIELDS.values():
        a[dst] = float(metrics[dst].sum())
    for dst in _MAX_FIELDS.values():
        a[dst] = int(metrics[dst].max()) if len(metrics) else 0
    for dst in _OR_FIELDS.values():
        a[dst] = bool(metrics[dst].any())
    return a


def compute_egp_complexity(dataset_df: pd.DataFrame, max_workers: int | None = None) -> pd.DataFrame:
    """Reavalia a complexidade de cada EGP (Bruto e Sem-dup).

    Reparsea (em paralelo) os `.sas` de `sas_by_egp/` listados no `dataset`,
    agrega por `egp_name` e aplica D1–D7. Retorna um DataFrame com:
        egp_name,
        categoria_egp, score_ponderado_egp,                 (todos os .sas)
        categoria_egp_sem_dup, score_ponderado_egp_sem_dup. (só não-duplicatas)
    EGP sem nenhum `.sas` não-duplicata → categoria/score Sem-dup = None/NaN.
    """
    in_egp = dataset_df[dataset_df["egp_name"].notna()].copy()
    paths = in_egp["file_path"].tolist()

    if max_workers is None:
        max_workers = min(_MAX_WORKERS_CAP, os.cpu_count() or 1)

    print(
        f"  Reavaliando complexidade de EGPs: reparseando {len(paths):,} .sas "
        f"({max_workers} processos)..."
    )
    with ProcessPoolExecutor(max_workers=max_workers) as ex:
        # chunksize amortiza o overhead de IPC em ~53k itens leves.
        parsed = list(ex.map(_parse_one, paths, chunksize=64))

    rows = [p for p in parsed if p is not None]
    n_fail = len(parsed) - len(rows)
    if n_fail:
        print(f"  AVISO: {n_fail} arquivo(s) .sas não puderam ser reparseados (ignorados).")
    metrics = pd.DataFrame(rows)

    # Junta egp_name + flag de duplicata (verdade do dataset) aos métricos brutos.
    meta = in_egp[["file_path", "egp_name", "is_likely_duplicate"]]
    metrics = metrics.merge(meta, on="file_path", how="inner")

    out_rows: list[dict] = []
    for egp_name, grp in metrics.groupby("egp_name", sort=True):
        score_b, cat_b = _score_from_agg(_aggregate(grp))
        nodup = grp[~grp["is_likely_duplicate"]]
        if len(nodup):
            score_s, cat_s = _score_from_agg(_aggregate(nodup))
        else:
            score_s, cat_s = float("nan"), None
        out_rows.append(
            {
                "egp_name": egp_name,
                "categoria_egp": cat_b,
                "score_ponderado_egp": score_b,
                "categoria_egp_sem_dup": cat_s,
                "score_ponderado_egp_sem_dup": score_s,
            }
        )
    return pd.DataFrame(out_rows)
