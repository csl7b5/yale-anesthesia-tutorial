# Deploy the `ai-chat` Edge Function (step by step)

Your site calls Supabase at  
`https://<project-ref>.supabase.co/functions/v1/ai-chat`.  
That function must be **deployed once** from your laptop (or CI); **`git push` alone does not deploy it.**

---

## Prerequisites (one-time on Supabase)

1. Run **`011_chat_queries.sql`** in the SQL Editor (creates `chat_queries`).
2. **Edge Function secrets:** Project **Settings → Edge Functions → Secrets** → add **`OPENAI_API_KEY`** (your OpenAI key). Never commit this key to GitHub.

---

## Supabase CLI on your Mac (your current layout)

You unzipped the official CLI into the repo under:

`supabase/supabase_darwin_arm64/`

The executable is:

**`supabase/supabase_darwin_arm64/supabase`**

Important:

- The folder **`supabase/`** at the project root is also where **`functions/ai-chat/`** lives.  
- Do **not** run `./supabase` by itself from the project root — that refers to the **directory**, not the CLI (you get `is a directory`).
- Always use the **full path** to the binary below, or move/rename the binary (see end).

### 1. Make it executable and verify

From the **project root** (`Yale Anesthesia Tutorial`):

```bash
cd "/Users/lolcreative883/Desktop/Yale Anesthesia Tutorial"
chmod +x supabase/supabase_darwin_arm64/supabase
./supabase/supabase_darwin_arm64/supabase --version
```

You should see a version number.

### 2. Log in to Supabase

```bash
./supabase/supabase_darwin_arm64/supabase login
```

Complete the browser login when prompted.

### 3. Deploy `ai-chat`

Replace `YOUR_PROJECT_REF` with **Settings → General → Reference ID** in the Supabase Dashboard:

```bash
cd "/Users/lolcreative883/Desktop/Yale Anesthesia Tutorial"
./supabase/supabase_darwin_arm64/supabase functions deploy ai-chat --project-ref YOUR_PROJECT_REF
```

Example:

```bash
./supabase/supabase_darwin_arm64/supabase functions deploy ai-chat --project-ref fpdlxevzbyqkztauwtno
```

Wait until the command finishes without errors.

### 4. Confirm in the dashboard

**Edge Functions** → you should see **`ai-chat`**.

### 5. Publish the website

```bash
git add .
git commit -m "…"
git push
```

So GitHub Pages serves the latest `platform/js/ai-chat.js` and chat UI.

### 6. Test

1. Open your live site, **sign in**.
2. Open the AI chat (Pyxis or ventilator), send a message.
3. Optional: **Table Editor → `chat_queries`** — a new row should appear after each successful reply.

---

## Optional: shorter command (alias or move binary)

To avoid typing the long path every time:

```bash
mkdir -p "$HOME/bin"
cp supabase/supabase_darwin_arm64/supabase "$HOME/bin/supabase-cli"
chmod +x "$HOME/bin/supabase-cli"
```

Add to `~/.zshrc` (or `~/.bash_profile`):

```bash
export PATH="$HOME/bin:$PATH"
```

Then reload the shell and use:

```bash
supabase-cli login
supabase-cli functions deploy ai-chat --project-ref YOUR_PROJECT_REF
```

---

## What runs where

| Piece | Where |
|--------|--------|
| Static site (HTML/JS) | GitHub Pages after `git push` |
| `ai-chat` Edge Function | Supabase (after **deploy** above) |
| OpenAI call | Inside the function, using **`OPENAI_API_KEY`** secret |

You do **not** need to keep your Mac online for visitors; deploy is a one-off upload (repeat when you change `supabase/functions/ai-chat/index.ts`).

---

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| `./supabase: is a directory` | You ran `./supabase` — use `./supabase/supabase_darwin_arm64/supabase` from project root (see above). |
| Wrong architecture | Intel Mac needs `supabase_darwin_amd64` from [CLI releases](https://github.com/supabase/cli/releases/latest), not `arm64`. |
| Deploy errors | Confirm `supabase/functions/ai-chat/index.ts` exists; run `supabase login` again. |
| Chat 401 | User must be **signed in** on the site. |
| Chat 500 / “Assistant unavailable” | Check **`OPENAI_API_KEY`** secret; check **Edge Functions → ai-chat → Logs**. |
