# Deploy — Cogna Migration Mission Control

Alvo escolhido: **tudo no Vercel** (uma plataforma só). O frontend Next.js e a API
FastAPI sobem juntos: a API vira uma **função serverless Python** (`frontend/api/index.py`)
e o frontend a chama em **same-origin** (`/api/*`).

> O motor (`core.py`) NÃO é reimplementado: uma cópia byte-a-byte é vendorizada em
> `frontend/_engine/` por um script, e os dados viram **CSV enxuto** (sem `pyarrow`,
> para caber no limite de 250 MB da função). A função pesa ~6 MB de dados + libs.

---

## 0. Gerar o engine vendorizado (sempre antes de commitar, se algo mudou)

Rode LOCALMENTE (onde há `pyarrow`):
```bash
python frontend/scripts/build_engine.py
```
Isso (re)gera `frontend/_engine/` (core.py/models.py/serializers.py vendorizados +
`data/dataset.csv` e `data/rollup.csv`). **Rode de novo** sempre que `core.py`,
`api/models.py`, `api/serializers.py` ou os parquet mudarem. Os arquivos gerados
**precisam ser commitados**.

## 1. Repositório Git (privado)

Dados internos da Cogna → **repositório PRIVADO**.
```bash
cd C:\Code\Cogna_sas_projects
git init
git add .          # .gitignore exclui xlsx/.sas/.egp crus; MANTÉM frontend/_engine
git commit -m "Cogna Mission Control — Next + API serverless (Vercel)"
git remote add origin <URL_DO_REPO_PRIVADO>
git push -u origin main
```
Confirme no commit: `frontend/_engine/data/*.csv`, `frontend/api/index.py`,
`frontend/vercel.json`, `frontend/requirements.txt`. (O `.xlsx` **não** deve entrar.)

## 2. Vercel (uma importação só)

1. [vercel.com](https://vercel.com) → **Add New Project** → importe o repo.
2. **Root Directory = `frontend`**. O Vercel detecta:
   - **Next.js** (frontend) — build automático.
   - **Função Python** em `api/index.py` — instala `frontend/requirements.txt`
     (fastapi, pandas, openpyxl) e empacota `_engine/**` (via `vercel.json`).
3. **Environment Variables** (Project Settings → Environment Variables):
   - `NEXT_PUBLIC_API_BASE` → **deixe em branco** (vazio = same-origin `/api`).
     *(Se existir um `.env.local` versionado com localhost, NÃO afeta o Vercel; mas
     garanta que essa env não esteja setada para localhost no painel.)*
   - *(opcional, recomendado)* `BASIC_AUTH_USER` e `BASIC_AUTH_PASS` → liga o gate
     de senha (`frontend/middleware.ts`). Sem elas, o site fica aberto.
4. **Deploy.** Teste:
   - `https://SEU-APP.vercel.app/api/health` → `{"status":"ok","n_linhas":54972,...}`
   - Abra o site: topbar "ao vivo" + KPIs (Bruto 311.532 h / Sem-dup 133.661 h).

### Como o roteamento funciona
`vercel.json` reescreve `/api/(.*)` → a função `api/index.py`. O wrapper
`EnsureApiPrefix` na função garante o casamento das rotas independente de como o
Vercel apresentar o path (`/api/...` ou `/...`). Validado localmente nas duas formas.

---

## ⚠️ Notas importantes

- **Não testável daqui:** o empacotamento/roteamento do Vercel só se confirma no
  deploy. A LÓGICA está validada localmente contra os CSVs (números idênticos ao
  Streamlit/parquet). Se `/api/health` responder, o resto responde igual.
- **Cold start:** função serverless hiberna; o 1º acesso após ociosidade carrega
  pandas + CSV (~2-4s). Para apresentação ao vivo, abra o site 1 min antes.
- **Limite de execução:** plano Hobby = 10s/requisição. Os endpoints rodam em <1s.
- **Confidencialidade:** repo privado + deploy sem fontes crus + gate de senha
  opt-in na UI. Exposição residual: os endpoints `/api/*` ficam acessíveis por URL.
  Para fechar, dá para exigir um token na função (posso implementar).
- **Python:** a função usa o runtime Python do Vercel (3.12). Sem `pyarrow`/`uvicorn`.

---

## Alternativas (NÃO usadas — só referência)
- `render.yaml` (raiz) sobe a API no Render como serviço separado (split Vercel+Render).
- Demo sem hospedar: rode local (`uvicorn api.main:app` + `npm run dev`) e exponha
  com `cloudflared tunnel --url http://localhost:3000`.

---

## Desenvolvimento local (inalterado)
```bash
python prepare_data.py                 # 1x — parquet
uvicorn api.main:app --port 8000       # API local (lê parquet)
cd frontend && npm run dev             # usa .env.local → http://localhost:8000
```
