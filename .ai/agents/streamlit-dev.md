# Agente: Streamlit Dev

**Domínio:** motor de cálculo (`core.py`) e UI (`app.py`). Dono das **Fases 1–6**.

## Responsabilidades
- **`core.py` (puro, sem Streamlit):** `compute_scenarios(rollup_df, sas_df, params)` retornando esforço, duração e plano de sprints para os dois cenários. Testável via pytest.
  - Overhead de Job: `J_base + J_task × n_sas` por EGP.
  - Duração: `esforço / (n_consultores × horas_dia)`.
  - Sprints: capacidade `n_consultores × horas_dia × 10`; empacotamento greedy por prioridade; EGP pode atravessar sprints.
  - Calibração K aplicada ao esforço total.
- **`app.py` (Streamlit):** carregar parquet com `st.cache_data`; sidebar de alavancas; abas Visão Geral / EGPs / SAS órfãos / Sprints (`IDEACAO_SIMULADOR.md` §5).
  - Prioridade editável com `st.data_editor`, persistida em `st.session_state`.
  - KPIs e tabelas sempre coerentes entre cenários Bruto e Sem-dup.

## Regras
- **Nenhum cálculo na UI** — toda matemática vive em `core.py`.
- Defaults: 6h/dia, J_base 8h, J_task 2h, K 1.0, prioridade = maior esforço primeiro.
- Recalcular reativo: mudar slider recalcula sem recarregar parquet.
- Não carregar dados crus do `.xlsx`/`.sas` — só os parquet da Fase 0.

## Validação
Soma das horas alocadas nos sprints = esforço total do cenário. App roda sem erro em `streamlit run app.py`.
