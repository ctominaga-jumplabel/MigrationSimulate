# -*- coding: utf-8 -*-
"""
Simulador de Esforço — Migração SAS -> Databricks (PySpark).

Camada de UI (Streamlit). NÃO contém cálculo: orquestra widgets e consome o
motor puro em `core.py` (AIOS.md §12 — cálculo fora da UI).

    - Funções puras (agregações + motor) vivem em `core.py`.
    - Insumos read-only: lemos só os parquet da Fase 0 (cache único, abaixo).
    - Não recalculamos `horas_estimadas`.
"""
from __future__ import annotations

import datetime as _dt

import pandas as pd

from core import (
    CATEGORIA_ORDER,
    build_export,
    categoria_distribution,
    compute_scenarios,
    egp_table,
    load_parquets,
    orphan_table,
    overview_metrics,
    pack_sprints,
    sas_children,
)


# ---------------------------------------------------------------------------
# UI (Streamlit). Tudo abaixo só roda quando executado via `streamlit run`.
# ---------------------------------------------------------------------------
def _fmt(v, dec: int = 0) -> str:
    """Formata número no padrão pt-BR (milhar com ponto, decimal com vírgula)."""
    s = f"{v:,.{dec}f}"  # ex.: "311,532.0" (en-US)
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def _build_sidebar(st) -> dict:
    """Sidebar de alavancas + cenário GLOBAL. Retorna o dict `params`."""
    st.sidebar.header("Cenário")
    cenario_label = st.sidebar.radio(
        "Cenário ativo (todas as abas)",
        options=["Bruto", "Sem duplicatas"],
        key="cenario_global",
        help="Bruto = todos os EGPs + órfãos. Sem-dup = só o EGP canônico de "
        "cada família (colapso de versões) + órfãos não-duplicados. "
        "O cenário escolhido vale para todas as abas e para o export.",
    )
    cenario = "sem_dup" if cenario_label == "Sem duplicatas" else "bruto"

    st.sidebar.header("Alavancas")
    n_consultores = st.sidebar.slider("Nº de consultores", 1, 50, 5)
    horas_dia = st.sidebar.slider("Horas produtivas/dia", 4, 8, 6)
    J_base = st.sidebar.number_input(
        "J_base (overhead fixo por Job, h)", min_value=0.0, value=8.0, step=1.0,
        help="Overhead fixo de orquestração por Job no Databricks (1 por EGP).",
    )
    J_task = st.sidebar.number_input(
        "J_task (overhead por .sas, h)", min_value=0.0, value=2.0, step=0.5,
        help="Overhead de orquestração por .sas dentro do Job. "
        "Horas Job de um EGP = J_base + J_task × n_sas.",
    )
    K = st.sidebar.selectbox(
        "Fator de calibração K",
        options=[0.8, 1.0, 1.3],
        index=1,
        help="0.8 time sênior · 1.0 padrão · 1.3 time novo em SAS. "
        "K multiplica o esforço total (proficiência da equipe).",
    )
    data_inicio = st.sidebar.date_input("Data de início", value=_dt.date(2026, 6, 15))
    st.sidebar.caption(
        "J_base/J_task são estimativas de partida (calibrar com o time). "
        "Calendário pula fins de semana, mas não considera feriados (v1)."
    )
    return {
        "n_consultores": n_consultores,
        "horas_dia": horas_dia,
        "J_base": J_base,
        "J_task": J_task,
        "K": K,
        "data_inicio": data_inicio,
        "cenario": cenario,
        "cenario_export": cenario,
    }


def _render_overview(st, px, dataset_df, scenarios: dict, params: dict) -> None:
    """Visão Geral: KPIs Bruto vs Sem-dup (com esforço/duração/sprints reais)."""
    st.subheader("Visão Geral")
    st.caption(
        "KPIs lado a lado nos dois cenários. **Bruto** = todos os EGPs (cada um "
        "com Job) + todos os órfãos. **Sem-dup (por família)** = só o EGP canônico "
        "de cada `pipeline_family` (1 Job/família) + órfãos não-duplicados. "
        "Esforço total já inclui overhead de Job e o fator K."
    )

    desc = overview_metrics(dataset_df)
    bruto, sem_dup = scenarios["bruto"], scenarios["sem_dup"]
    desc_b, desc_s = desc["bruto"], desc["sem_dup_arquivo"]

    col_b, col_s = st.columns(2)
    with col_b:
        st.markdown("### Cenário Bruto")
        st.metric("Esforço total (sas+Job, ×K)", f"{_fmt(bruto['esforco_total'])} h")
        st.metric("  ↳ horas .sas (incl. órfãos)", f"{_fmt(bruto['horas_sas'])} h")
        st.metric("  ↳ horas Job (overhead)", f"{_fmt(bruto['horas_job'])} h")
        st.metric("Duração (dias úteis)", _fmt(bruto["duracao_dias_uteis"], 1))
        st.metric("Nº de sprints", _fmt(bruto["n_sprints"]))
        st.metric("Nº de EGPs", _fmt(bruto["n_egps"]))
        st.metric("Nº de .sas órfãos", _fmt(bruto["n_orfaos"]))
        st.metric("Nº total de .sas", _fmt(desc_b["n_sas"]))
    with col_s:
        st.markdown("### Cenário Sem-dup (por família)")
        st.metric("Esforço total (sas+Job, ×K)", f"{_fmt(sem_dup['esforco_total'])} h")
        st.metric("  ↳ horas .sas (incl. órfãos)", f"{_fmt(sem_dup['horas_sas'])} h")
        st.metric("  ↳ horas Job (overhead)", f"{_fmt(sem_dup['horas_job'])} h")
        st.metric("Duração (dias úteis)", _fmt(sem_dup["duracao_dias_uteis"], 1))
        st.metric("Nº de sprints", _fmt(sem_dup["n_sprints"]))
        st.metric("Nº de EGPs (canônicos)", _fmt(sem_dup["n_egps"]))
        st.metric("Nº de .sas órfãos", _fmt(sem_dup["n_orfaos"]))
        st.metric("Pipeline families", _fmt(desc_s["n_pipeline_family"]))

    cap = params["n_consultores"] * params["horas_dia"] * 10
    st.info(
        "**Bruto × Sem-dup.** *Bruto* conta todos os EGPs e órfãos (duplicatas já "
        "entram com ×0,3 pela metodologia). *Sem-dup (por família)* colapsa as versões "
        "de um mesmo pipeline no EGP **canônico** (o de maior esforço da família) e, "
        "dentro dele, soma só os `.sas` não-duplicados — é o cenário mais enxuto. "
        "**Horas Job** = overhead de orquestração (`J_base + J_task × n_sas`, 1 por "
        "EGP). **K** multiplica o esforço total (proficiência da equipe)."
    )
    st.caption(
        f"Capacidade por sprint = n_consultores × horas_dia × 10 = {_fmt(cap)} h. "
        f"Fator K = {params['K']} aplicado ao esforço total."
    )
    st.caption(
        "Nota: o recorte **nível-arquivo** (`is_likely_duplicate==False`, sem "
        f"colapso de famílias) somaria {_fmt(desc_s['horas_totais'])} h de "
        "`horas_estimadas`. Esse número é apenas descritivo — o cenário **Sem-dup** "
        "oficial é por-família (canônico) e usa o esforço acima."
    )
    st.warning(
        "Premissas: a heurística de **`pipeline_family`** (colapso de versões por "
        "sufixos) é aproximada — validar amostra com o cliente antes de virar número "
        "oficial. O calendário de sprints pula fins de semana mas **não considera "
        "feriados** (v1). J_base/J_task são estimativas a calibrar; as horas herdam as "
        "premissas da metodologia (`METODOLOGIA_AVALIACAO_SAS.md`)."
    )

    st.markdown("#### Distribuição por categoria")
    dist = categoria_distribution(dataset_df)

    fig_count = px.bar(
        dist,
        x="categoria",
        y="n_sas",
        text="n_sas",
        title="Contagem de .sas por categoria",
        labels={"categoria": "Categoria", "n_sas": "Nº de .sas"},
    )
    fig_count.update_xaxes(categoryorder="array", categoryarray=CATEGORIA_ORDER)

    fig_horas = px.bar(
        dist,
        x="categoria",
        y="soma_horas",
        text=dist["soma_horas"].map(lambda v: f"{v:,.0f}"),
        title="Soma de horas (Bruto) por categoria",
        labels={"categoria": "Categoria", "soma_horas": "Horas estimadas"},
    )
    fig_horas.update_xaxes(categoryorder="array", categoryarray=CATEGORIA_ORDER)

    g1, g2 = st.columns(2)
    g1.plotly_chart(fig_count, use_container_width=True)
    g2.plotly_chart(fig_horas, use_container_width=True)


def _render_egps(st, rollup_df, dataset_df, params: dict) -> None:
    """Aba EGPs: tabela editável (prioridade) e .sas filhos. Cenário global."""
    cenario = params["cenario"]
    st.subheader("EGPs")
    st.caption(
        f"Cenário **{('Sem-dup (por família)' if cenario == 'sem_dup' else 'Bruto')}** "
        "(selecionado na sidebar). Uma linha por EGP. **Horas Job** = overhead de "
        "orquestração = `J_base + J_task × n_sas` (1 Job por EGP). **Horas total** = "
        "Horas .sas + Horas Job. **Prioridade** é editável (1 = primeiro); o default "
        "segue o maior esforço. (O fator K não entra nesta tabela; é aplicado ao "
        "esforço total e à fila de sprints.)"
    )

    base = egp_table(rollup_df, params, cenario)
    base = base.copy()
    base.insert(0, "prioridade", range(1, len(base) + 1))

    state_key = f"prioridade_egp_{cenario}"
    saved = st.session_state.get(state_key, {})
    if saved:
        base["prioridade"] = (
            base["egp_name"].map(saved).fillna(base["prioridade"]).astype(int)
        )

    base = base.sort_values(["prioridade", "horas_total"], ascending=[True, False])
    base = base.reset_index(drop=True)

    edited = st.data_editor(
        base,
        use_container_width=True,
        hide_index=True,
        height=420,
        key=f"editor_egp_{cenario}",
        column_config={
            "prioridade": st.column_config.NumberColumn(
                "Prioridade", min_value=1, step=1, format="%d"
            ),
            "egp_name": st.column_config.TextColumn("EGP"),
            "n_sas": st.column_config.NumberColumn("Nº .sas", format="%d"),
            "horas_sas": st.column_config.NumberColumn("Horas .sas", format="%.1f"),
            "horas_job": st.column_config.NumberColumn("Horas Job", format="%.1f"),
            "horas_total": st.column_config.NumberColumn("Horas total", format="%.1f"),
            "categoria_predominante": st.column_config.TextColumn("Categoria predom."),
        },
        disabled=[
            "egp_name",
            "n_sas",
            "horas_sas",
            "horas_job",
            "horas_total",
            "categoria_predominante",
        ],
    )

    st.session_state[state_key] = dict(
        zip(edited["egp_name"], edited["prioridade"].astype(int))
    )

    c1, c2, c3 = st.columns(3)
    c1.metric("EGPs", f"{len(edited):,}")
    c2.metric("Horas .sas (total)", f"{edited['horas_sas'].sum():,.1f} h")
    c3.metric("Horas total (Job incl.)", f"{edited['horas_total'].sum():,.1f} h")

    st.markdown("#### .sas de um EGP")
    egp_sel = st.selectbox(
        "Escolha um EGP", options=edited["egp_name"].tolist(), key=f"sel_egp_{cenario}"
    )
    if egp_sel:
        filhos = sas_children(dataset_df, egp_sel)
        with st.expander(f"{len(filhos)} .sas em «{egp_sel}»", expanded=True):
            st.dataframe(
                filhos,
                use_container_width=True,
                hide_index=True,
                column_config={
                    "file_name": st.column_config.TextColumn("Arquivo .sas"),
                    "categoria": st.column_config.TextColumn("Categoria"),
                    "horas_estimadas": st.column_config.NumberColumn(
                        "Horas estimadas", format="%.1f"
                    ),
                    "is_likely_duplicate": st.column_config.CheckboxColumn(
                        "Provável duplicata"
                    ),
                },
            )


def _render_orphans(st, dataset_df, params: dict) -> None:
    """Aba SAS órfãos: tabela editável (prioridade) e total. Cenário global."""
    cenario = params["cenario"]
    st.subheader("SAS órfãos")
    st.caption(
        f"Cenário **{('Sem-dup' if cenario == 'sem_dup' else 'Bruto')}** "
        "(selecionado na sidebar). Os `.sas` de `all_sas/` que não pertencem a "
        "nenhum EGP (órfão não tem overhead de Job). No cenário Sem-dup ficam só os "
        "não-duplicados. **Prioridade** é editável (1 = primeiro); o default segue "
        "as maiores horas estimadas."
    )

    base = orphan_table(dataset_df, cenario)
    base = base.copy()
    base.insert(0, "prioridade", range(1, len(base) + 1))

    state_key = f"prioridade_orfao_{cenario}"
    saved = st.session_state.get(state_key, {})
    if saved:
        base["prioridade"] = (
            base["file_name"].map(saved).fillna(base["prioridade"]).astype(int)
        )

    base = base.sort_values(["prioridade", "horas_estimadas"], ascending=[True, False])
    base = base.reset_index(drop=True)

    edited = st.data_editor(
        base,
        use_container_width=True,
        hide_index=True,
        height=420,
        key=f"editor_orfao_{cenario}",
        column_config={
            "prioridade": st.column_config.NumberColumn(
                "Prioridade", min_value=1, step=1, format="%d"
            ),
            "file_name": st.column_config.TextColumn("Arquivo .sas"),
            "categoria": st.column_config.TextColumn("Categoria"),
            "horas_estimadas": st.column_config.NumberColumn(
                "Horas estimadas", format="%.1f"
            ),
        },
        disabled=["file_name", "categoria", "horas_estimadas"],
    )

    st.session_state[state_key] = dict(
        zip(edited["file_name"], edited["prioridade"].astype(int))
    )

    c1, c2 = st.columns(2)
    c1.metric("SAS órfãos", f"{len(edited):,}")
    c2.metric("Horas estimadas (total)", f"{edited['horas_estimadas'].sum():,.1f} h")


def _prioridades_from_state(st, cenario: str) -> dict | None:
    """Monta o dict de prioridades do usuário para um cenário a partir do
    session_state das abas EGPs/órfãos.

    Retorna `{("egp"|"orfao", nome): prioridade_int}` ou None se nada editado.
    As chaves combinam com a fila de `core._itens_fila` (tipo, nome).
    """
    prios: dict = {}
    egp_saved = st.session_state.get(f"prioridade_egp_{cenario}", {}) or {}
    for nome, p in egp_saved.items():
        prios[("egp", nome)] = int(p)
    orfao_saved = st.session_state.get(f"prioridade_orfao_{cenario}", {}) or {}
    for nome, p in orfao_saved.items():
        prios[("orfao", nome)] = int(p)
    return prios or None


def _render_sprints(st, px, dataset_df, rollup_df, params: dict) -> None:
    """Aba Sprints (Fase 5/6): KPIs, tabela por sprint, detalhe de itens,
    gráficos e EXPORT. Cenário global (sidebar). Respeita a prioridade editada
    pelo usuário. Cálculo todo em core.py; aqui só renderiza."""
    cenario = params["cenario"]
    st.subheader("Sprints")
    st.caption(
        f"Cenário **{('Sem-dup' if cenario == 'sem_dup' else 'Bruto')}** "
        "(sidebar). Empacotamento greedy por **prioridade efetiva**. Capacidade por "
        "sprint = n_consultores × horas_dia × 10. As horas de cada item já incluem o "
        "overhead de Job (nos EGPs) e o fator **K**. Um item (EGP/órfão) pode "
        "atravessar sprints. A prioridade vem das abas EGPs e SAS órfãos; itens não "
        "editados seguem o default (maior esforço primeiro)."
    )

    # Prioridade do usuário (session_state das outras abas) -> fila reordenada.
    prioridades = _prioridades_from_state(st, cenario)
    if prioridades:
        st.caption(
            f"Aplicando **{len(prioridades)}** prioridade(s) editada(s) neste cenário."
        )
    scenarios = compute_scenarios(
        dataset_df, rollup_df, params, prioridades=prioridades
    )
    cen = scenarios[cenario]

    packed = pack_sprints(cen["itens"], params)
    resumo = packed["resumo_sprints"]
    alocacao = packed["alocacao"]

    # --- KPIs no topo ------------------------------------------------------
    data_fim_ultimo = resumo["data_fim"].iloc[-1] if len(resumo) else None
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Nº de sprints", f"{len(resumo):,}")
    c2.metric(
        "Término do último sprint",
        data_fim_ultimo.strftime("%d/%m/%Y") if data_fim_ultimo else "—",
    )
    c3.metric("Esforço total (×K)", f"{cen['esforco_total']:,.0f} h")
    c4.metric("Duração (dias úteis)", f"{cen['duracao_dias_uteis']:,.1f}")

    if len(resumo) == 0:
        st.info("Capacidade insuficiente para agendar (verifique consultores/horas).")
        return

    # % de ocupação por sprint.
    resumo = resumo.copy()
    resumo["ocupacao_pct"] = (
        resumo["horas_alocadas"] / resumo["capacidade"] * 100.0
    ).where(resumo["capacidade"] > 0, 0.0)

    # --- Gráfico de ocupação (barras: alocado vs capacidade) ---------------
    st.markdown("#### Ocupação por sprint")
    cap_sprint = float(resumo["capacidade"].iloc[0])
    fig_occ = px.bar(
        resumo,
        x="sprint",
        y="horas_alocadas",
        title="Horas alocadas por sprint (linha = capacidade)",
        labels={"sprint": "Sprint", "horas_alocadas": "Horas alocadas"},
    )
    fig_occ.add_hline(
        y=cap_sprint,
        line_dash="dash",
        annotation_text=f"Capacidade {cap_sprint:,.0f} h",
    )
    st.plotly_chart(fig_occ, use_container_width=True)

    # --- Tabela por sprint -------------------------------------------------
    st.markdown("#### Detalhe por sprint")
    st.dataframe(
        resumo[
            [
                "sprint",
                "data_inicio",
                "data_fim",
                "horas_alocadas",
                "capacidade",
                "ocupacao_pct",
                "itens_no_sprint",
            ]
        ],
        use_container_width=True,
        hide_index=True,
        column_config={
            "sprint": st.column_config.NumberColumn("Sprint", format="%d"),
            "data_inicio": st.column_config.DateColumn("Início"),
            "data_fim": st.column_config.DateColumn("Fim"),
            "horas_alocadas": st.column_config.NumberColumn(
                "Horas alocadas", format="%.1f"
            ),
            "capacidade": st.column_config.NumberColumn("Capacidade", format="%.1f"),
            "ocupacao_pct": st.column_config.NumberColumn("% ocupação", format="%.1f%%"),
            "itens_no_sprint": st.column_config.NumberColumn(
                "Itens no sprint", format="%d"
            ),
        },
    )

    # --- Itens de um sprint selecionado ------------------------------------
    st.markdown("#### Itens de um sprint")
    sprint_sel = st.selectbox(
        "Escolha um sprint",
        options=resumo["sprint"].tolist(),
        key=f"sel_sprint_{cenario}",
    )
    itens_sprint = alocacao[
        (alocacao["sprint_inicial"] <= sprint_sel)
        & (alocacao["sprint_final"] >= sprint_sel)
    ]
    st.caption(
        f"{len(itens_sprint)} item(ns) ativo(s) no sprint {sprint_sel} "
        "(inclui itens que atravessam sprints)."
    )
    st.dataframe(
        itens_sprint,
        use_container_width=True,
        hide_index=True,
        column_config={
            "prioridade": st.column_config.NumberColumn("Prioridade", format="%d"),
            "tipo": st.column_config.TextColumn("Tipo"),
            "nome": st.column_config.TextColumn("Nome"),
            "horas": st.column_config.NumberColumn("Horas (×K)", format="%.1f"),
            "sprint_inicial": st.column_config.NumberColumn(
                "Sprint inicial", format="%d"
            ),
            "sprint_final": st.column_config.NumberColumn("Sprint final", format="%d"),
        },
    )

    # --- Gantt simples dos N maiores itens ---------------------------------
    st.markdown("#### Timeline (maiores itens)")
    n_top = st.slider(
        "Nº de itens no Gantt", 5, 50, 20, key=f"gantt_n_{cenario}"
    )
    top = alocacao.sort_values("horas", ascending=False).head(n_top).copy()
    if len(top):
        # Mapeia sprint -> data_inicio/data_fim para desenhar barras por datas.
        ini_map = dict(zip(resumo["sprint"], resumo["data_inicio"]))
        fim_map = dict(zip(resumo["sprint"], resumo["data_fim"]))
        top["start"] = top["sprint_inicial"].map(ini_map)
        top["finish"] = top["sprint_final"].map(fim_map)
        top["label"] = top["tipo"] + " · " + top["nome"].astype(str)
        fig_gantt = px.timeline(
            top,
            x_start="start",
            x_end="finish",
            y="label",
            color="tipo",
            title=f"{len(top)} maiores itens ao longo dos sprints",
            labels={"label": "Item"},
        )
        fig_gantt.update_yaxes(autorange="reversed")
        st.plotly_chart(fig_gantt, use_container_width=True)

    # --- Export (Excel/CSV) ------------------------------------------------
    st.markdown("#### Exportar plano")
    st.caption(
        f"Gera uma planilha do cenário **{('Sem-dup' if cenario == 'sem_dup' else 'Bruto')}** "
        "com as alavancas e a prioridade atuais. Abas: `egps`, `orfaos`, "
        "`resumo_sprints`, `alocacao`."
    )
    export = build_export(dataset_df, rollup_df, params, prioridades=prioridades)
    xlsx = _export_to_xlsx(export)
    nome_base = f"plano_sprints_{cenario}_{params['data_inicio'].isoformat()}"
    e1, e2 = st.columns(2)
    e1.download_button(
        "Baixar Excel (.xlsx)",
        data=xlsx,
        file_name=f"{nome_base}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    e2.download_button(
        "Baixar resumo de sprints (.csv)",
        data=export["resumo_sprints"].to_csv(index=False).encode("utf-8-sig"),
        file_name=f"{nome_base}_resumo.csv",
        mime="text/csv",
    )


def _export_to_xlsx(abas: dict) -> bytes:
    """Serializa o dict de DataFrames (de `core.build_export`) num .xlsx em
    memória (openpyxl). Uma aba por chave. Sem Streamlit; só I/O em BytesIO."""
    import io

    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        for nome, df in abas.items():
            # Nomes de aba do Excel: máx. 31 chars.
            df.to_excel(writer, sheet_name=nome[:31], index=False)
    return buf.getvalue()


def main() -> None:  # pragma: no cover - só executado por `streamlit run`
    import streamlit as st
    import plotly.express as px

    st.set_page_config(
        layout="wide",
        page_title="Simulador de Esforço — Migração SAS → Databricks",
    )
    st.title("Simulador de Esforço — Migração SAS → Databricks (PySpark)")

    # Carga cacheada dos parquet (ponto único de cache).
    cached_loader = st.cache_data(load_parquets)
    dataset_df, rollup_df = cached_loader()

    params = _build_sidebar(st)

    # Motor recalculado a cada interação com as alavancas.
    scenarios = compute_scenarios(dataset_df, rollup_df, params)

    tab_visao, tab_egps, tab_orfaos, tab_sprints = st.tabs(
        ["Visão Geral", "EGPs", "SAS órfãos", "Sprints"]
    )
    with tab_visao:
        _render_overview(st, px, dataset_df, scenarios, params)
    with tab_egps:
        _render_egps(st, rollup_df, dataset_df, params)
    with tab_orfaos:
        _render_orphans(st, dataset_df, params)
    with tab_sprints:
        _render_sprints(st, px, dataset_df, rollup_df, params)


if __name__ == "__main__":  # pragma: no cover
    main()
