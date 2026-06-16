# FRONTEND TRANSFORMATION PLAN — Cogna Migration Mission Control

**Criado em:** 2026-06-15
**Origem:** transformação do frontend (v1 Streamlit → experiência executiva premium).
**Autoridade:** subordinado a `AIOS.md`. Estado de execução vive aqui e em `CURRENT_STATE.md`.

---

## 0. Decisões fundadoras (confirmadas com o usuário)

1. **Integração de dados = API Python fina (FastAPI)** que embrulha `core.py` —
   **zero cálculo novo no frontend** (AIOS §10). O frontend faz `fetch` a cada
   mudança de alavanca; `core.py` permanece a única fonte de cálculo.
2. **Escopo = build completo autônomo (Fases A→J)**.
3. **Streamlit (`app.py`) é preservado como legado/protótipo** — não será quebrado.
4. **Stack do frontend:** Next.js (App Router) + TypeScript + Tailwind + Motion
   (framer-motion) + Iconsax (iconsax-react). Anime.js só para animações especiais.
   React Three Fiber **opcional e sutil** (hero/background) — só se não custar perf.

---

## 1. Diagnóstico (Fase A — CONCLUÍDA)

### O que existe e deve ser preservado intacto
- `prepare_data.py` — ETL (xlsx read-only → `data/dataset.parquet` 54.972 linhas +
  `data/egp_rollup.parquet` 3.198 EGPs). **Não tocar.**
- `core.py` — motor puro/testável. Funções reaproveitadas pela API:
  `load_parquets`, `overview_metrics`, `categoria_distribution`, `egp_table`,
  `sas_children`, `orphan_table`, `canonical_rollup`, `compute_scenarios`,
  `pack_sprints`, `build_export`, const `CATEGORIA_ORDER`. **Não tocar a lógica.**
- `app.py` — Streamlit. Permanece como legado.
- `tests/test_core.py` — 24 testes. Continuam o gate de fidelidade do motor.

### Schema disponível para o frontend (via API)
- `egp_rollup.parquet`: `egp_name, n_sas, soma_horas_sas, categoria_predominante,
  pipeline_family, n_sas_sem_dup, soma_horas_sas_sem_dup`.
- `dataset.parquet`: 60+ colunas; o frontend usa o subconjunto exposto por
  `core` (`file_name, categoria, horas_estimadas, is_likely_duplicate,
  egp_name, is_orphan, pipeline_family`).

### Ambiente
- Node v24.13, npm 11.8, Python 3.13 — todos disponíveis.

### Riscos de integração
- **R1 — Duplicação de cálculo:** mitigado por API fina; frontend nunca recalcula.
- **R2 — Serialização de DataFrames:** API converte para JSON; cuidar de
  `NaN`/`inf` (ex.: `duracao` infinita com capacidade 0) → sanitizar.
- **R3 — Datas:** `pack_sprints` retorna `datetime.date`; serializar ISO.
- **R4 — Payload grande:** 3.198 EGPs + 1.869 órfãos + filas de itens. Paginar/
  resumir no servidor; não mandar a fila inteira quando só os KPIs são pedidos.
- **R5 — Dois processos na apresentação:** documentar script único de subida
  (`run` que sobe API + Next), e CORS restrito a localhost.
- **R6 — Fidelidade numérica:** os números exibidos devem bater com os de
  `CURRENT_STATE.md` (Bruto 311.532 h / Sem-dup 133.661 h nos defaults). Gate de QA.

---

## 2. Arquitetura-alvo (Fase B)

```
repo/
├── prepare_data.py        # ETL (intacto)
├── core.py                # motor puro (intacto)
├── app.py                 # Streamlit legado (intacto)
├── data/*.parquet         # insumos gerados (intactos)
├── api/                   # NOVO — FastAPI fino sobre core.py (sem cálculo novo)
│   ├── main.py            # app + rotas + CORS + carga única dos parquet
│   ├── models.py          # Pydantic: Params, Prioridade
│   ├── serializers.py     # DataFrame→JSON, sanitização NaN/inf, datas ISO
│   └── requirements.txt   # fastapi, uvicorn, (reusa pandas/pyarrow do core)
└── frontend/              # NOVO — Next.js App Router
    ├── app/               # rotas: overview, scenario, pipelines, orphans,
    │                      #   sprints, timeline, analytics, export
    ├── components/        # design system + componentes de domínio
    ├── lib/               # api client, store (zustand), tipos, format pt-BR
    ├── styles/            # tokens, globals
    └── ...config
```

### Contrato da API (todas as rotas reusam `core.py`, nada de cálculo novo)
| Método | Rota | core.* usado | Retorno |
|---|---|---|---|
| GET | `/api/health` | — | status |
| GET | `/api/catalog` | `overview_metrics`, `categoria_distribution` | dados fixos (independem de alavanca) |
| POST | `/api/scenarios` | `compute_scenarios` | KPIs Bruto+Sem-dup (sem a fila bruta) |
| POST | `/api/egps` | `egp_table` | tabela de EGPs do cenário (paginável) |
| POST | `/api/egps/{egp}/children` | `sas_children` | `.sas` filhos |
| POST | `/api/orphans` | `orphan_table` | tabela de órfãos |
| POST | `/api/sprints` | `compute_scenarios`+`pack_sprints` | resumo + alocação |
| POST | `/api/export` | `build_export` (+ serialização xlsx) | `.xlsx`/`.csv` |

`params` no corpo: `n_consultores, horas_dia, J_base, J_task, K, data_inicio,
cenario, prioridades?`. A serialização xlsx vive na API (espelha `app._export_to_xlsx`),
**não** em `core` (que continua puro).

### Camada de dados do frontend
- `lib/api.ts` — cliente tipado (fetch) com base URL configurável.
- `lib/store.ts` — Zustand: estado global das alavancas + cenário ativo +
  prioridades editadas. Debounce nas chamadas à API.
- React Query (TanStack) para cache/!revalidação das respostas da API.

---

## 3. Design System Premium (Fase C)

- **Tema:** dark premium; fundo gradiente sutil + grão; superfícies em
  glassmorphism discreto (blur + borda 1px translúcida + sombra suave).
- **Tokens** (Tailwind theme): paleta (base near-black, superfícies, acento
  Cogna, semânticas success/warn/danger), raios, sombras, blur, tipografia
  (display + sans + mono para números), spacing/grid.
- **Componentes base:** `Card`/`GlassCard`, `KpiCard` (com contador animado),
  `Badge`, `Button`, `Tooltip`, `Slider`, `NumberInput`, `SegmentedControl`
  (cenário), `Table` expansível, `EmptyState`, `Skeleton`/loading, `Sidebar`,
  `TopBar`, `SectionHeader`, `StatDelta` (economia Bruto×Sem-dup).
- **Referências de qualidade** (não copiar): Vercel, Linear, Stripe, Arc,
  Vision Pro, Datadog.

---

## 4. Telas (Fases D–I) — navegação

1. **Overview** — hero "Cogna Migration Mission Control" + KPIs animados
   (esforço, duração, sprints, EGPs, órfãos, economia Bruto×Sem-dup) +
   comparação Bruto×Sem-dup + distribuição por categoria.
2. **Scenario Builder** — alavancas premium com feedback instantâneo + resumo
   de impacto + textos que explicam as regras (consultores↓duração não esforço;
   K multiplica; J_base/J_task = overhead de Job; Sem-dup = heurística família).
3. **Pipelines (EGPs)** — grid/lista de cards com busca, filtros, ordenação
   (esforço/prioridade/categoria), expansão p/ `.sas` filhos, prioridade editável,
   horas .sas/Job/total, destaque dos críticos. Tabela avançada como alternativa.
4. **Orphans** — cards/tabela premium, busca, filtro por categoria, prioridade
   editável, totalizadores, nota de que órfão não tem overhead de Job.
5. **Sprint Planner** — cards por sprint, ocupação/capacidade, datas, itens,
   itens que atravessam sprints, gráfico de ocupação, timeline/Gantt premium.
6. **Timeline** — visão cronológica dos sprints/itens (Gantt premium dedicado).
7. **Analytics** — gráficos modernos (distribuição, esforço por categoria,
   Bruto×Sem-dup, sensibilidade às alavancas).
8. **Export** — exportar Excel/CSV (via API), resumo dos parâmetros usados,
   alertas de premissas/riscos, visão pronta para apresentação.

---

## 5. Regras de negócio (NÃO podem ser quebradas — herdadas do AIOS §12)

- Esforço por `.sas` = `horas_estimadas` (nunca recalcular).
- EGP = Σ horas `.sas` + overhead de Job; overhead = `J_base + J_task × n_sas`.
- Bruto × Sem-dup coerentes; Sem-dup oficial = por família/canônico.
- Mais consultores reduzem **duração**, não esforço.
- Sprint = 10 dias úteis; capacidade = `n_consultores × horas_dia × 10`.
- K multiplica o esforço total. Órfãos não têm overhead de Job.
- Totais derivados reconciliam com `core.py`/planilha (gate de QA).

---

## 6. Fluxo de execução (AIOS §5 — caminho Completo)

Orchestrator → Specialist(s) → Reviewer → QA → Memory Manager → Snapshot.

| Fase | Entregável | Agente líder |
|---|---|---|
| A — Diagnóstico | este plano + agentes | orchestrator |
| B — Arquitetura | `api/` FastAPI + scaffold `frontend/` + DECISIONS | frontend-architect |
| C — Design System | tokens + componentes base | product-designer + frontend-dev |
| D — Overview | tela inicial com impacto | frontend-dev + motion-designer |
| E — Scenario Builder | alavancas reativas | frontend-dev |
| F — Pipelines | grid de EGPs | frontend-dev |
| G — Orphans | visão de órfãos | frontend-dev |
| H — Sprint Planner | sprints + timeline | frontend-dev + motion-designer |
| I — Timeline/Analytics/Export | gráficos + export | frontend-dev |
| J — QA + Snapshot | validações + estado | visual-qa + qa + memory-manager |

### Quality Gates específicos do frontend
- [ ] `pytest -q` continua verde (motor intacto).
- [ ] API responde e os KPIs batem com `CURRENT_STATE.md` (fidelidade).
- [ ] `npm run build` do frontend passa; `npm run lint`/typecheck sem erros.
- [ ] Nenhuma regra de negócio reimplementada no TS.
- [ ] Responsivo; sem excesso de animação; legível; premium.
- [ ] Snapshot em `.ai/state/` atualizado.

---

## 7. Comandos (alvo)
```
data:   python prepare_data.py
api:    uvicorn api.main:app --reload --port 8000
front:  cd frontend && npm run dev          # http://localhost:3000
test:   pytest -q                           # motor
build:  cd frontend && npm run build
legado: streamlit run app.py
```

---

## 8. Estado / pendências
Execução em andamento. Progresso e pendências serão refletidos em
`CURRENT_STATE.md`, `DECISIONS.md` (append-only) e `NEXT_STEPS.md` ao fim das fases.
