# -*- coding: utf-8 -*-
"""Smoke tests do motor de cálculo (core.py) — Fase 4.

Cobrem: totais Bruto, órfãos, escala de K, mais consultores → menos sprints,
Bruto ≥ Sem-dup, e conservação de horas no empacotamento de sprints.
"""
from __future__ import annotations

import datetime as _dt
import math
import os
import sys

import pandas as pd
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import core  # noqa: E402


def _params(**overrides) -> dict:
    base = {
        "n_consultores": 5,
        "horas_dia": 6,
        "J_base": 8.0,
        "J_task": 2.0,
        "K": 1.0,
        "data_inicio": _dt.date(2026, 6, 15),
    }
    base.update(overrides)
    return base


@pytest.fixture(scope="module")
def data():
    return core.load_parquets()


@pytest.fixture(scope="module")
def dataset_df(data):
    return data[0]


@pytest.fixture(scope="module")
def rollup_df(data):
    return data[1]


def test_bruto_horas_sas_e_job(dataset_df, rollup_df):
    """(1) Bruto: horas_sas (EGPs) ≈ 141.655 e horas_job = 131.790 com defaults."""
    sc = core.compute_scenarios(dataset_df, rollup_df, _params())
    bruto = sc["bruto"]
    # horas_sas do cenário inclui órfãos; o componente de EGPs é soma_horas_sas.
    horas_sas_egps = float(rollup_df["soma_horas_sas"].sum())
    assert horas_sas_egps == pytest.approx(141655.25, abs=1.0)
    assert bruto["horas_job"] == pytest.approx(131790.0, abs=1.0)


def test_orfaos_bruto_soma(dataset_df, rollup_df):
    """(2) Órfãos Bruto: Σ horas_estimadas ≈ 38.086."""
    orf = core.orphan_table(dataset_df, "bruto")
    assert float(orf["horas_estimadas"].sum()) == pytest.approx(38086.45, abs=1.0)


def test_K_dobra_esforco(dataset_df, rollup_df):
    """(3) K=2.0 dobra esforco_total vs K=1.0."""
    sc1 = core.compute_scenarios(dataset_df, rollup_df, _params(K=1.0))
    sc2 = core.compute_scenarios(dataset_df, rollup_df, _params(K=2.0))
    for cen in ("bruto", "sem_dup"):
        assert sc2[cen]["esforco_total"] == pytest.approx(
            2.0 * sc1[cen]["esforco_total"], rel=1e-9
        )


def test_mais_consultores_menos_sprints(dataset_df, rollup_df):
    """(4) Dobrar n_consultores ≈ metade dos sprints (±1 por arredondamento)."""
    sc1 = core.compute_scenarios(dataset_df, rollup_df, _params(n_consultores=5))
    sc2 = core.compute_scenarios(dataset_df, rollup_df, _params(n_consultores=10))
    for cen in ("bruto", "sem_dup"):
        esperado = sc1[cen]["n_sprints"] / 2
        assert abs(sc2[cen]["n_sprints"] - esperado) <= 1


def test_bruto_maior_ou_igual_semdup(dataset_df, rollup_df):
    """(5) Bruto esforco_total ≥ Sem-dup esforco_total."""
    sc = core.compute_scenarios(dataset_df, rollup_df, _params())
    assert sc["bruto"]["esforco_total"] >= sc["sem_dup"]["esforco_total"]


def test_pack_sprints_conserva_horas(dataset_df, rollup_df):
    """(6) pack_sprints: Σ horas dos sprints == esforço total (tol. flutuante)."""
    params = _params()
    sc = core.compute_scenarios(dataset_df, rollup_df, params)
    for cen in ("bruto", "sem_dup"):
        itens = sc[cen]["itens"]
        packed = core.pack_sprints(itens, params)
        soma_sprints = float(packed["resumo_sprints"]["horas_alocadas"].sum())
        assert soma_sprints == pytest.approx(float(itens["horas"].sum()), rel=1e-9)
        # E conserva o esforço total do cenário.
        assert soma_sprints == pytest.approx(sc[cen]["esforco_total"], rel=1e-9)
        # n_sprints do resumo bate com o do cenário.
        assert len(packed["resumo_sprints"]) == sc[cen]["n_sprints"]


def test_itens_fila_estrutura(dataset_df, rollup_df):
    """A fila unificada tem as colunas esperadas e prioridade contígua 1..N."""
    sc = core.compute_scenarios(dataset_df, rollup_df, _params())
    itens = sc["bruto"]["itens"]
    assert list(itens.columns) == ["prioridade", "tipo", "nome", "horas"]
    assert set(itens["tipo"].unique()) <= {"egp", "orfao"}
    assert list(itens["prioridade"]) == list(range(1, len(itens) + 1))


# ---------------------------------------------------------------------------
# Fase 4 — correções do reviewer/QA.
# ---------------------------------------------------------------------------
def test_canonical_rollup_uma_linha_por_familia(rollup_df):
    """(7) canonical_rollup: 1 linha por pipeline_family (≈1.516)."""
    canon = core.canonical_rollup(rollup_df)
    n_familias = rollup_df["pipeline_family"].nunique(dropna=False)
    assert len(canon) == n_familias
    assert len(canon) == pytest.approx(1516, abs=0)
    # Cada família aparece exatamente uma vez.
    assert canon["pipeline_family"].nunique(dropna=False) == len(canon)
    # Σ horas_sas_sem_dup dos canônicos reconcilia com a Visão Geral (~63.779).
    assert float(canon["soma_horas_sas_sem_dup"].sum()) == pytest.approx(
        63779.47, abs=1.0
    )


def test_canonical_rollup_empate_escolhe_primeiro():
    """(8) Em empate de soma_horas_sas na família, escolhe o primeiro (estável)."""
    df = pd.DataFrame(
        {
            "egp_name": ["A", "B", "C"],
            "n_sas": [1, 1, 1],
            "soma_horas_sas": [10.0, 10.0, 5.0],  # A e B empatam (família "fam")
            "categoria_predominante": ["Trivial", "Trivial", "Trivial"],
            "pipeline_family": ["fam", "fam", "outra"],
            "n_sas_sem_dup": [1, 1, 1],
            "soma_horas_sas_sem_dup": [10.0, 10.0, 5.0],
        }
    )
    canon = core.canonical_rollup(df)
    # Família "fam": empate entre A (índice 0) e B (índice 1) → escolhe A.
    fam_row = canon[canon["pipeline_family"] == "fam"]
    assert len(fam_row) == 1
    assert fam_row.iloc[0]["egp_name"] == "A"


def test_duracao_dias_uteis_formula(dataset_df, rollup_df):
    """(9) duracao_dias_uteis ≈ esforco_total/(n_consultores×horas_dia)
    e duracao_dias_uteis/10 ≈ n_sprints."""
    params = _params()
    sc = core.compute_scenarios(dataset_df, rollup_df, params)
    cap_dia = params["n_consultores"] * params["horas_dia"]
    for cen in ("bruto", "sem_dup"):
        s = sc[cen]
        esperado = s["esforco_total"] / cap_dia
        assert s["duracao_dias_uteis"] == pytest.approx(esperado, rel=1e-9)
        # duracao/10 próximo de n_sprints (n_sprints arredonda para cima).
        assert abs(s["duracao_dias_uteis"] / 10 - s["n_sprints"]) <= 1
        # duracao_horas = esforço por consultor = duracao_dias × horas_dia.
        assert s["duracao_horas"] == pytest.approx(
            s["duracao_dias_uteis"] * params["horas_dia"], rel=1e-9
        )


def test_duracao_valores_defaults(dataset_df, rollup_df):
    """(10) Com defaults (5,6): dur Bruto ≈10.384 / Sem-dup ≈4.455;
    n_sprints 1039 / 446."""
    sc = core.compute_scenarios(dataset_df, rollup_df, _params())
    assert sc["bruto"]["duracao_dias_uteis"] == pytest.approx(10384.4, abs=1.0)
    assert sc["sem_dup"]["duracao_dias_uteis"] == pytest.approx(4455.4, abs=1.0)
    assert sc["bruto"]["n_sprints"] == 1039
    assert sc["sem_dup"]["n_sprints"] == 446


def test_egp_table_semdup_canonico(dataset_df, rollup_df):
    """(11) egp_table sem_dup opera só sobre canônicos (≈1.516 linhas) e
    Σ horas_total bate com horas_sas(EGPs canôn.)+horas_job de scenarios."""
    params = _params()
    tab = core.egp_table(rollup_df, params, "sem_dup")
    canon = core.canonical_rollup(rollup_df)
    assert len(tab) == len(canon)
    assert len(tab) == pytest.approx(1516, abs=0)

    sc = core.compute_scenarios(dataset_df, rollup_df, params)
    sd = sc["sem_dup"]
    # horas_sas do cenário inclui órfãos; o componente de EGPs canônicos é a
    # soma de soma_horas_sas_sem_dup. horas_total da tabela = esse + horas_job.
    horas_egps_canon = float(canon["soma_horas_sas_sem_dup"].sum())
    assert float(tab["horas_total"].sum()) == pytest.approx(
        horas_egps_canon + sd["horas_job"], abs=1.0
    )


def test_egp_table_semdup_mais_orfaos_reconcilia(dataset_df, rollup_df):
    """(12) Σ horas_total(egp_table sem_dup) + Σ órfãos sem_dup ≈ esforço
    Sem-dup (sem K)."""
    params = _params(K=1.0)
    tab = core.egp_table(rollup_df, params, "sem_dup")
    orf = core.orphan_table(dataset_df, "sem_dup")
    total_abas = float(tab["horas_total"].sum()) + float(orf["horas_estimadas"].sum())

    sc = core.compute_scenarios(dataset_df, rollup_df, params)
    # esforço Sem-dup sem K = esforco_base (K=1.0 aqui de qualquer forma).
    assert total_abas == pytest.approx(sc["sem_dup"]["esforco_base"], abs=1.0)


def test_orphan_table_semdup_coerente(dataset_df):
    """(13) Órfãos Sem-dup ≈ 1.156 linhas / ~34.255 h (já coerente)."""
    orf = core.orphan_table(dataset_df, "sem_dup")
    assert len(orf) == pytest.approx(1156, abs=0)
    assert float(orf["horas_estimadas"].sum()) == pytest.approx(34255.0, abs=5.0)


def test_overview_metrics_sem_dup_arquivo_renomeado(dataset_df):
    """(14) overview_metrics expõe 'sem_dup_arquivo' (não 'sem_dup') e não
    deve ser confundido com o Sem-dup oficial."""
    om = core.overview_metrics(dataset_df)
    assert "bruto" in om
    assert "sem_dup_arquivo" in om
    assert "sem_dup" not in om  # evita reuso acidental como "o" Sem-dup


# ---------------------------------------------------------------------------
# Fase 5 — prioridade do usuário na fila de itens.
# ---------------------------------------------------------------------------
def test_prioridades_override_traz_item_para_sprint1(dataset_df, rollup_df):
    """(16) Forçar um item pequeno para prioridade 1 o coloca no topo da fila
    e no sprint 1 do empacotamento."""
    params = _params()
    sc_default = core.compute_scenarios(dataset_df, rollup_df, params)
    itens_def = sc_default["bruto"]["itens"]

    # Pega um item de baixo esforço (cauda da fila default).
    pequeno = itens_def.iloc[-1]
    chave = (pequeno["tipo"], pequeno["nome"])

    prioridades = {"bruto": {chave: 1}}
    sc = core.compute_scenarios(dataset_df, rollup_df, params, prioridades=prioridades)
    itens = sc["bruto"]["itens"]

    # O item forçado é o primeiro da fila (prioridade efetiva 1).
    primeiro = itens.iloc[0]
    assert (primeiro["tipo"], primeiro["nome"]) == chave
    assert int(primeiro["prioridade"]) == 1

    # E entra no sprint 1 do empacotamento.
    packed = core.pack_sprints(itens, params)
    linha = packed["alocacao"]
    linha = linha[(linha["tipo"] == chave[0]) & (linha["nome"] == chave[1])]
    assert int(linha.iloc[0]["sprint_inicial"]) == 1


def test_prioridades_override_conserva_horas(dataset_df, rollup_df):
    """(17) Com a fila reordenada por prioridade, pack_sprints continua
    conservando horas (Σ == esforço total) e o nº de itens não muda."""
    params = _params()
    sc_def = core.compute_scenarios(dataset_df, rollup_df, params)
    pequeno = sc_def["bruto"]["itens"].iloc[-1]
    prioridades = {"bruto": {(pequeno["tipo"], pequeno["nome"]): 1}}

    sc = core.compute_scenarios(dataset_df, rollup_df, params, prioridades=prioridades)
    itens = sc["bruto"]["itens"]
    # Mesmo conjunto de itens, só reordenado.
    assert len(itens) == len(sc_def["bruto"]["itens"])
    assert list(itens["prioridade"]) == list(range(1, len(itens) + 1))

    packed = core.pack_sprints(itens, params)
    soma_sprints = float(packed["resumo_sprints"]["horas_alocadas"].sum())
    assert soma_sprints == pytest.approx(float(itens["horas"].sum()), rel=1e-9)
    assert soma_sprints == pytest.approx(sc["bruto"]["esforco_total"], rel=1e-9)


def test_prioridades_faltantes_caem_para_o_fim_por_esforco():
    """(18) Itens ausentes do override caem para o fim, ordenados por esforço
    (desempate default), atrás dos itens com prioridade explícita."""
    egp_rows = pd.DataFrame(
        {
            "nome": ["G", "P"],  # Grande e Pequeno
            "horas_sas": [100.0, 1.0],
            "horas_job": [0.0, 0.0],
        }
    )
    orphan_rows = pd.DataFrame({"nome": ["O1", "O2"], "horas": [50.0, 30.0]})

    # Só o pequeno EGP "P" recebe prioridade explícita (1). Os demais faltam.
    prioridades = {("egp", "P"): 1}
    itens = core._itens_fila(egp_rows, orphan_rows, K=1.0, prioridades=prioridades)

    ordem = list(zip(itens["tipo"], itens["nome"]))
    # "P" primeiro (prioridade 1). Faltantes em seguida por horas desc:
    # G (100) > O1 (50) > O2 (30).
    assert ordem == [("egp", "P"), ("egp", "G"), ("orfao", "O1"), ("orfao", "O2")]
    assert list(itens["prioridade"]) == [1, 2, 3, 4]


def test_prioridades_none_igual_default(dataset_df, rollup_df):
    """(19) Sem override (None) o resultado é idêntico ao default por esforço."""
    params = _params()
    a = core.compute_scenarios(dataset_df, rollup_df, params)
    b = core.compute_scenarios(dataset_df, rollup_df, params, prioridades=None)
    pd.testing.assert_frame_equal(a["bruto"]["itens"], b["bruto"]["itens"])
    pd.testing.assert_frame_equal(a["sem_dup"]["itens"], b["sem_dup"]["itens"])


# ---------------------------------------------------------------------------
# Fase 6 — fechamento (validação cruzada) e export.
# ---------------------------------------------------------------------------
def test_fechamento_horas_dataset_reconcilia_bruto(dataset_df, rollup_df):
    """(20) A soma de `horas_estimadas` do dataset (≈179.742) reconcilia com o
    `horas_sas` do cenário Bruto (EGPs + órfãos, sem Job e sem K)."""
    total_dataset = float(dataset_df["horas_estimadas"].sum())
    assert total_dataset == pytest.approx(179741.70, abs=1.0)

    sc = core.compute_scenarios(dataset_df, rollup_df, _params(K=1.0))
    # horas_sas do Bruto = Σ horas_estimadas de TODOS os .sas (EGPs + órfãos).
    assert sc["bruto"]["horas_sas"] == pytest.approx(total_dataset, abs=1.0)


def test_build_export_abas_e_linhas(dataset_df, rollup_df):
    """(21) build_export produz as 4 abas esperadas com linhas coerentes:
    egps Bruto=3.198 / Sem-dup=1.516; órfãos Bruto=1.869."""
    # --- Bruto ---
    exp_b = core.build_export(dataset_df, rollup_df, _params(cenario_export="bruto"))
    assert set(exp_b.keys()) == {"egps", "orfaos", "resumo_sprints", "alocacao"}
    assert len(exp_b["egps"]) == 3198
    assert len(exp_b["orfaos"]) == 1869
    # alocação cobre toda a fila (EGPs + órfãos).
    assert len(exp_b["alocacao"]) == 3198 + 1869
    # resumo_sprints bate com n_sprints do cenário.
    sc_b = core.compute_scenarios(dataset_df, rollup_df, _params())
    assert len(exp_b["resumo_sprints"]) == sc_b["bruto"]["n_sprints"]

    # --- Sem-dup ---
    exp_s = core.build_export(dataset_df, rollup_df, _params(cenario_export="sem_dup"))
    assert len(exp_s["egps"]) == 1516
    assert set(exp_s.keys()) == {"egps", "orfaos", "resumo_sprints", "alocacao"}


def test_build_export_escreve_xlsx_em_memoria(dataset_df, rollup_df):
    """(22) As abas de build_export serializam num .xlsx (openpyxl) em BytesIO
    e relêm com os mesmos nomes de aba."""
    import io

    exp = core.build_export(dataset_df, rollup_df, _params(cenario_export="bruto"))
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for nome, df in exp.items():
            df.to_excel(writer, sheet_name=nome[:31], index=False)
    assert buf.getbuffer().nbytes > 0
    buf.seek(0)
    xl = pd.ExcelFile(buf, engine="openpyxl")
    assert set(xl.sheet_names) == {"egps", "orfaos", "resumo_sprints", "alocacao"}


def test_build_export_cenario_invalido(dataset_df, rollup_df):
    """(23) cenario_export inválido levanta ValueError."""
    with pytest.raises(ValueError):
        core.build_export(dataset_df, rollup_df, _params(cenario_export="foo"))


def test_pack_sprints_capacidade_zero_concorda(dataset_df, rollup_df):
    """(15) Capacidade=0 (n_consultores=0): n_sprints e len(resumo_sprints)
    concordam (ambos 0)."""
    params = _params(n_consultores=0)
    sc = core.compute_scenarios(dataset_df, rollup_df, params)
    for cen in ("bruto", "sem_dup"):
        packed = core.pack_sprints(sc[cen]["itens"], params)
        assert sc[cen]["n_sprints"] == 0
        assert len(packed["resumo_sprints"]) == 0
        assert len(packed["resumo_sprints"]) == sc[cen]["n_sprints"]
