# TensorZero Gateway — Deployment Guide

The TensorZero gateway routes all LLM calls from Supabase edge functions through a
single, observable, and eventually-optimizable endpoint deployed on Fly.io's free tier.

## Architecture

```
Supabase Edge Functions  →  TensorZero Gateway (Fly.io)  →  OpenAI gpt-4o-mini
                             - logs every call to Supabase Postgres
                             - handles auth, fallbacks, future A/B tests
```

---

## First-time setup (~15 min)

### 1. Install the Fly.io CLI

```bash
brew install flyctl
fly auth login
```

### 2. Install the Supabase CLI (if not already)

```bash
brew install supabase/tap/supabase
```

### 3. Create the Fly.io app

Run this from the `tensorzero/` directory:

```bash
cd tensorzero
fly launch --name anesthesia-playground-tz --region iad --no-deploy
```

When prompted, say **No** to adding a Postgres database (we use Supabase's Postgres).

### 4. Set Fly.io secrets

Get your Supabase Postgres connection string from:
**Supabase Dashboard → Project Settings → Database → Connection string → URI**
(Use the "Session mode" pooler URI if available, e.g. `postgres://postgres.xxx:password@aws-0-us-east-1.pooler.supabase.com:5432/postgres`)

```bash
fly secrets set \
  OPENAI_API_KEY="sk-..." \
  TENSORZERO_POSTGRES_URL="postgres://postgres.xxx:password@..." \
  --app anesthesia-playground-tz
```

### 5. Deploy

```bash
fly deploy
```

The first deploy takes 2–3 minutes. Once complete, your gateway is live at:
`https://anesthesia-playground-tz.fly.dev`

### 6. Create a TensorZero API key

SSH into the running machine and create a key:

```bash
fly ssh console --app anesthesia-playground-tz
# Inside the container:
tensorzero create-api-key --name "supabase-edge-functions"
# → prints something like: tzk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
exit
```

### 7. Add the key to Supabase edge function secrets

Go to **Supabase Dashboard → Edge Functions → Secrets** and add:

| Secret name | Value |
|---|---|
| `TENSORZERO_URL` | `https://anesthesia-playground-tz.fly.dev` |
| `TENSORZERO_API_KEY` | `tzk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |

Remove `OPENAI_API_KEY` from Supabase secrets — it now lives only on Fly.io.

---

## Verifying it works

```bash
# Check gateway health
curl https://anesthesia-playground-tz.fly.dev/health

# Test an inference (replace tzk_... with your actual key)
curl -X POST https://anesthesia-playground-tz.fly.dev/openai/v1/chat/completions \
  -H "Authorization: Bearer tzk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tensorzero::function_name::ai_chat",
    "messages": [{"role": "user", "content": "What is PEEP?"}]
  }'
```

---

## Updating the config

Edit `tensorzero/config/tensorzero.toml`, then redeploy:

```bash
cd tensorzero && fly deploy
```

---

## Adding a new LLM function

1. Add a `[functions.my_function]` block to `tensorzero.toml`
2. Run `fly deploy`
3. Use `model: "tensorzero::function_name::my_function"` in the edge function

---

## Monitoring

View live logs:
```bash
fly logs --app anesthesia-playground-tz
```

View inference history in the TensorZero UI (local only):
```bash
# Run against your Supabase Postgres — replace the connection string
docker run -p 3001:3000 \
  -e TENSORZERO_CLICKHOUSE_URL="" \
  tensorzero/ui
```

Or query directly in Supabase's SQL editor:
```sql
select function_name, model_name, input_tokens, output_tokens, created_at
from tensorzero_inferences
order by created_at desc
limit 50;
```

---

## Secrets reference

| Location | Secret | Value |
|---|---|---|
| Fly.io | `OPENAI_API_KEY` | Your OpenAI API key |
| Fly.io | `TENSORZERO_POSTGRES_URL` | Supabase Postgres connection URI |
| Supabase Edge Functions | `TENSORZERO_URL` | `https://anesthesia-playground-tz.fly.dev` |
| Supabase Edge Functions | `TENSORZERO_API_KEY` | TensorZero gateway API key (`tzk_...`) |
