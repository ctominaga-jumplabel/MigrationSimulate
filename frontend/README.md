# Cogna Migration Mission Control — Frontend

Frontend executivo premium do **Simulador de Esforço (Migração SAS → Databricks)**.
Substitui visualmente o protótipo Streamlit, **sem reimplementar nenhuma regra de
cálculo**: todos os números vêm da API fina (`../api/`), que embrulha `core.py`.

## Stack
- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** (tema dark premium, glassmorphism) — tokens em `tailwind.config.ts`
- **Framer Motion** (transições, contadores animados) — respeita `prefers-reduced-motion`
- **Iconsax** (`iconsax-react`) — ícones
- **Zustand** (estado das alavancas/cenário/prioridades) + **TanStack React Query** (cache)
- **Recharts** (gráficos)

## Como rodar

Pré-requisito: a **API** precisa estar no ar (porta 8000). Na raiz do repositório:

```bash
pip install -r api/requirements.txt
python prepare_data.py          # 1x — gera data/*.parquet (se ainda não existir)
uvicorn api.main:app --port 8000
```

Depois, neste diretório:

```bash
npm install
npm run dev                     # http://localhost:3000
```

> A API libera CORS para `http://localhost:3000`. A base URL é configurável em
> `.env.local` (`NEXT_PUBLIC_API_BASE`).

## Scripts
```bash
npm run dev        # desenvolvimento
npm run build      # build de produção
npm start          # serve o build
npm run typecheck  # tsc --noEmit
npm run lint       # eslint (next lint)
```

## Arquitetura (camadas)
```
frontend/
├── app/                 # rotas (8 áreas): /, /scenario, /pipelines, /orphans,
│   │                    #   /sprints, /timeline, /analytics, /export
│   ├── layout.tsx       # sidebar fixa + topbar (cenário global) + providers
│   └── providers.tsx    # React Query
├── components/
│   ├── ui/              # design system (Card, KpiCard, Badge, Lever, etc.)
│   ├── charts/          # gráficos (recharts) com tema dark
│   ├── domain/          # componentes de domínio (ScenarioCompare)
│   └── layout/          # Sidebar, Topbar, Icon, nav
└── lib/
    ├── api.ts           # cliente da API (fetch tipado)
    ├── hooks.ts         # hooks React Query + useParams (lê o store)
    ├── store.ts         # Zustand: alavancas, cenário, prioridades
    ├── types.ts         # tipos do contrato da API
    ├── format.ts        # formatação pt-BR (apresentação)
    └── cn.ts            # util de classes
```

## Regra de ouro
**Nenhum cálculo de negócio no frontend.** Esforço, duração, sprints, overhead de
Job, cenário Sem-dup, empacotamento e export vêm sempre da API (`core.py`). O
frontend só apresenta, formata (pt-BR) e captura as alavancas/prioridades.
