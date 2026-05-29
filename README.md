# AI Browser Operator (MVP)

Local-first browser automation agent with **hybrid multi-model routing** across
**Gemini**, **DeepSeek**, **Groq**, and **OpenRouter**.

## Architecture

```
Your command
    │
    ▼
① Rule analyzer (keywords → planning / vision / writing signals)
    │
    ▼
② Rule presets (best default model per role)
    │   planning  → Groq Llama 70B
    │   vision    → Gemini Flash
    │   writing   → OpenRouter Claude Haiku
    │   reasoning → DeepSeek Reasoner
    │
    ▼
③ Gemini Flash orchestrator (picks/refines team from full catalog)
    │
    ▼
④ Coordinator builds a **planning brief** (goals, decomposition, step catalog, site rules) + reasoner/vision notes → planner
    │
    ▼
⑤ Playwright browser runner (+ captcha handoff to you)
```

The agent is **not** an LLM. It is a broker that routes, coordinates, and executes.

## Quick Start

1. Install:

   ```bash
   npm install
   npm run playwright:install
   ```

2. Configure keys in `.env` (copy from `.env.example`):

   ```env
   GEMINI_API_KEY=...      # required for orchestrator
   GROQ_API_KEY=...
   DEEPSEEK_API_KEY=...
   OPENROUTER_API_KEY=...
   ORCHESTRATOR_MODEL=gemini-2.0-flash
   ```

3. **One-time Gmail login** (Google blocks automated browsers — use real Chrome):

   ```bash
   npm run chrome    # opens normal Chrome — log into Gmail here
   npm run login     # verifies connection (optional)
   ```

   Keep that Chrome window running. Sessions are saved in `BROWSER_USER_DATA_DIR`.

4. Run:

   ```bash
   npm run dev
   ```

5. Create a task:

   ```bash
   curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d "{\"command\":\"open google and search cats\"}"
   ```

6. Resume after captcha:

   ```bash
   curl -X POST http://localhost:3000/tasks/<taskId>/resume -H "Content-Type: application/json" -d "{\"reason\":\"captcha_solved\"}"
   ```

## API

- `GET /health`
- `GET /models` — active adapters + full catalog profiles
- `POST /tasks` — `{ "command": "...", "model"?: "groq-llama-70b" }`
- `GET /tasks` / `GET /tasks/:id`
- `POST /tasks/:id/resume` — `{ "reason": "captcha_solved" }`

## Model catalog (providers)

| Role (preset) | Default model        | Provider    |
|---------------|----------------------|-------------|
| Planning      | `groq-llama-70b`     | Groq        |
| Vision        | `gemini-flash`       | Gemini      |
| Writing       | `openrouter-claude-haiku` | OpenRouter |
| Reasoning     | `deepseek-reasoner`  | DeepSeek    |

Gemini Flash also acts as **orchestrator** — it reviews rule presets and can swap
models when tasks are ambiguous or when strengths/weaknesses don't match.

Without API keys, `dummy` / `vision-dummy` adapters are used for offline testing.

### Planner debug

Set `LOG_PLANNER_IO=true` in `.env`, restart the server, run a task — the full prompt sent to the planner is written to `data/planner-last-request.md` (request + JSON response).

## Project layout

- `src/providers/` — Gemini, DeepSeek, Groq, OpenRouter clients
- `src/models/catalog.ts` — all models + strengths/weaknesses
- `src/models/rulePresets.ts` — best model per capability (rule path)
- `src/models/geminiOrchestrator.ts` — Gemini Flash team selection
- `src/models/planningBrief.ts` — structured brief for the planner
- `src/models/coordinator.ts` — cross-model context sharing
- `src/models/hybridRouter.ts` — rules → presets → orchestrator pipeline
- `src/browser/` — Playwright execution
