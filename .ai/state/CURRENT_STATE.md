# CURRENT_STATE

**Projeto:** Simulador de Esforço — Migração SAS → Databricks (PySpark)
**Atualizado em:** 2026-06-15

## Status
**v1 CONCLUÍDA** (Streamlit) + **v2 CONCLUÍDA** — frontend premium *Cogna Migration
Mission Control* (Next.js) sobre API fina (FastAPI) que embrulha `core.py`. Motor de
cálculo intacto. Pronto para apresentação executiva.

## Como rodar
```
python prepare_data.py               # 1x — gera data/*.parquet a partir do xlsx
pytest -q                            # 24 testes do motor (52s)

# Mission Control (frontend premium):
pip install -r api/requirements.txt
uvicorn api.main:app --port 8000     # API fina
cd frontend && npm install && npm run dev   # http://localhost:3000

# Legado:
streamlit run app.py
```

## Arquitetura (3 camadas + 2 frontends)
- **ETL:** `prepare_data.py` → `data/dataset.parquet` (54.972) + `data/egp_rollup.parquet` (3.198).
- **Núcleo:** `core.py` — funções puras/testáveis. **Única fonte de cálculo.** (intacto)
- **API:** `api/` (FastAPI) — embrulha `core.py`, **sem cálculo novo**. Sanitiza
  NaN/inf→null, date→ISO. Serialização `.xlsx` aqui (espelha `app._export_to_xlsx`).
  - `main.py` (rotas+CORS+carga única dos parquet), `models.py` (Pydantic Params),
    `serializers.py` (DataFrame→JSON).
- **Frontend premium:** `frontend/` — Next.js 15 (App Router) + TS + Tailwind +
  Framer Motion + Iconsax + Zustand + React Query + Recharts. Tema dark premium,
  glassmorphism, sidebar fixa, cenário global na topbar, contadores animados.
  - 8 telas: Overview · Scenario Builder · Pipelines · SAS Órfãos · Sprint Planner ·
    Timeline · Analytics · Export. Camada de dados em `lib/` (api/hooks/store/types/format).
- **Legado:** `app.py` (Streamlit) — preservado, funcional.

## O que funciona
- Frontend consome a API a cada mudança de alavanca (debounce via React Query);
  zero cálculo de negócio no TS. Cenário Bruto/Sem-dup global. Prioridade editável
  (EGPs e órfãos) por cenário, realimenta sprints e export.
- Export `.xlsx` (4 abas) e `.csv` via API (`core.build_export`).
- Build de produção verde; typecheck limpo; rotas servem HTTP 200.

## Números oficiais (defaults: 5 consultores, 6h/dia, J_base 8, J_task 2, K 1.0)
| Cenário | esforço_total | dias úteis | nº sprints |
|---|---|---|---|
| Bruto | 311.532 h | 10.384 | 1.039 |
| Sem-dup (família) | 133.661 h | 4.455 | 446 |
- Reconciliados via API (idênticos à v1). Σ horas_estimadas = 179.741,70 h.

## Deploy — TUDO no Vercel (configurado, não publicado)
- API FastAPI vira função serverless `frontend/api/index.py` (same-origin `/api/*`
  via `frontend/vercel.json`). Motor vendorizado em `frontend/_engine/` (gerado por
  `frontend/scripts/build_engine.py`: copia core/models/serializers + parquet→CSV
  enxuto, dispensa pyarrow). Passo a passo em `DEPLOY.md`. Gate de senha opt-in em
  `frontend/middleware.ts` (envs `BASIC_AUTH_USER/PASS`). Validado localmente
  (paridade idêntica via CSV); empacotamento real do Vercel só confirma no deploy.

## Quality Gates (v2) — APROVADOS
- pytest 24 passed (motor intacto) · API reconcilia com v1 (parquet E CSV) ·
  typecheck limpo · `npm run build` 11/11 páginas + middleware · rotas HTTP 200.

## Pendências (não bloqueiam — ver BACKLOG e NEXT_STEPS)
- Verificação visual em navegador real (interação ao vivo) e responsividade fina.
- Polimento opcional: R3F no hero, Anime.js pontual, testes E2E do frontend.
- Calibração com cliente (J_base/J_task/K) e validação da heurística pipeline_family.
