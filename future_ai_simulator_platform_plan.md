# Future Plan: AI-Driven Anesthesia Learning Simulator Platform

## Recommended direction

The best path is a **hybrid platform**:

- Keep the current site available in an **open, no-login mode** for lightweight orientation and broad access.
- Add an optional **student login experience** for persistent progress, performance tracking, adaptive AI feedback, and longitudinal learning.
- Add a separate **instructor login/dashboard** for learner oversight, cohort analytics, scenario assignment, and AI-generated teaching insights.

This approach preserves the project's current strengths as an accessible educational prototype while creating a path toward a more serious simulation and assessment platform.

---

## Product vision

This project evolves from a static educational prototype into an **interactive, AI-assisted anesthesia simulator** where students can safely work through scenarios, receive feedback on their decisions and interpretation of simulated patient responses, and build a longitudinal learning record over time. Faculty and educators can review individual and aggregate learner performance, identify misconceptions, assign targeted scenarios, and use AI-supported insights to improve teaching and curriculum design.

The current scenarios, monitor tutorials, and ventilator simulator form the foundation of this future platform. The immediate goal is not to replace those components, but to wrap them in a more structured user, feedback, and analytics system.

---

## Core recommendation

I recommend building this in **three parallel layers**:

### 1. Public educational layer

This is the existing website experience:

- No account required
- Students can freely explore the Pyxis, monitor tutorials, ventilator, and team pages
- Ideal for first exposure, quick review, and broad access

This should remain because:

- it lowers friction
- it helps with adoption
- it is useful for learners who are not ready to fully commit to tracked use
- it keeps the platform easy to demo and easy to share across institutions

### 2. Authenticated learner layer

This is the future student account experience:

- secure login
- saved scenario history
- progress across sessions
- performance analytics
- AI-generated debriefs and teaching moments
- recommended next scenarios based on prior weaknesses

This turns the project from a static teaching tool into a personalized learning system.

### 3. Authenticated educator layer

This is the instructor-facing dashboard:

- individual learner progress review
- cohort-level analytics
- insight into common misconceptions
- AI-generated summaries of learning trends
- scenario assignment and curricular targeting

This is what makes the platform useful not only for students, but for faculty and clerkship leadership.

---

## Student-side vision

## Student login experience

Students would have optional accounts that unlock:

- personal dashboard
- saved completed scenarios
- time-to-answer and completion metrics
- weak topic identification
- mastery/progress indicators
- scenario recommendations

### Example student dashboard features

- `Completed scenarios`
- `Scenarios in progress`
- `Average time to complete`
- `Most common weak domains`
- `Recommended next case`
- `Recent teaching points`

---

## AI features for students

The student-facing AI should be focused, structured, and faculty-bounded.

### 1. AI debrief after scenario completion

After a student completes a scenario, the system generates:

- what they did well
- where they struggled
- what clinical concept they may have missed
- one or two high-yield teaching points
- one recommended follow-up scenario or drill

This should be based on:

- scenario choices
- answer latency
- which tutorials they opened
- whether they completed or abandoned the scenario

### 2. AI-guided teaching moments during scenarios

Over time, the simulator could introduce contextual teaching interventions such as:

- "Pause and reflect" prompts
- hints after repeated delay or error
- explanation of why vitals changed the way they did
- short concept cards tied to waveform or physiology interpretation

These should be carefully controlled and only triggered at logical points, not constantly.

### 3. Longitudinal learner insights

Students should eventually be able to see:

- repeated errors across scenarios
- trend improvement over time
- domains of strength and weakness
- recommended content based on prior behavior

---

## Instructor-side vision

## Instructor login experience

Educators would have a separate login that unlocks:

- list of learners
- learner-specific performance pages
- cohort analytics
- scenario performance breakdowns
- usage and engagement reporting
- AI summaries of trends and trouble spots

### Example educator dashboard sections

### Individual learner view

- scenarios attempted
- completion rate
- median time-to-answer
- weak concepts by frequency
- monitor/pathology exposures
- performance over time

### Cohort view

- most completed scenarios
- highest drop-off scenarios
- most difficult steps by latency
- most commonly missed concepts
- least-used tutorials
- week-by-week usage

### Faculty planning view

- what concepts appear under-taught
- what scenarios should be assigned next
- what monitor topics students avoid
- what steps may need scenario redesign

---

## AI features for instructors

The instructor-side AI should summarize patterns, not replace human judgment.

### Recommended educator AI features

- AI-generated weekly summaries of cohort performance
- automatic flagging of difficult scenario steps
- identification of repeated misconception clusters
- suggested next scenarios for individuals or groups
- summary of engagement changes after curriculum edits

### Example instructor insight

"Students complete the bronchospasm scenario at a high rate but show prolonged latency and repeated errors on capnography interpretation, suggesting the waveform teaching component should be emphasized earlier."

All AI-generated insights should be reviewable and framed as suggestions, not authoritative evaluations.

---

## Simulation vision

The simulation layer should become more dynamic over time.

### Current baseline

- fixed scenarios
- predefined answer choices
- physiology-linked monitor behavior
- monitor tutorial interactions

### Future simulation direction

- scenarios remain faculty-authored
- patient responses become more adaptive and state-based
- ventilator, vitals, and monitor changes can respond to student actions in a more granular way
- scenario branches become deeper without needing to fully rely on generative AI

### Recommendation

Do **not** start with a freeform LLM-generated simulator. Instead:

- keep the physiology and scenario logic deterministic
- use AI primarily for feedback, summarization, and adaptive content recommendation

This is safer, easier to validate clinically, and more realistic for a pilot.

---

## Recommended architecture

## Best overall recommendation

Use a **modern web app architecture** while keeping the frontend experience close to the current site.

### Frontend

- Keep the current HTML/CSS/JS prototype as the conceptual basis
- Over time, migrate to a frontend framework if needed for state management
- Recommended eventual frontend:
  - `Next.js` or `React`
  - or keep a lightweight vanilla JS frontend for longer if you want to minimize complexity early

### Backend

You will eventually need a backend if you want:

- user accounts
- saved learner progress
- educator dashboards
- secure AI calls
- scenario assignment

Recommended backend options:

- `Supabase`
- `Firebase`
- or a small custom backend with `Node.js` and `Postgres`

My recommendation for speed and practicality:

- **Supabase** for auth + database + row-level security
- serverless functions for AI endpoints

This gives you:

- student/instructor authentication
- clean relational data model
- secure storage
- manageable complexity for a pilot

### AI layer

Do not call model APIs directly from the browser.

Recommended approach:

- frontend sends structured attempt data to a secure backend endpoint
- backend calls the AI model
- backend returns structured JSON feedback

Recommended AI use:

- scenario debrief generation
- concept summarization
- educator insight summaries
- retrieval-augmented chatbot responses

### Retrieval / RAG layer

For a teaching chatbot or explainability layer:

- store approved faculty-reviewed content
- use retrieval over:
  - scenario teaching points
  - faculty-authored explanations
  - approved anesthesia educational references

This is much safer than unconstrained generation.

---

## Recommended data model

At minimum, the future authenticated platform should store:

### Users

- user id
- role (`student`, `instructor`, `admin`)
- institution
- training level

### Scenario attempts

- attempt id
- user id
- scenario id
- start time
- end time
- completion status
- total time
- step-by-step answer log

### Scenario step events

- step number
- answer selected
- latency
- correctness
- hints used

### Tutorial interactions

- tutorial opened
- dwell time
- pathology selected
- tabs viewed

### AI outputs

- debrief text
- identified weak domains
- recommended next step
- educator summary snippets

---

## Login and access model

## Student access

- optional login for persistent features
- no login required for casual use

## Instructor access

- separate protected dashboard
- not visible from public experience
- institutional email restriction preferred

Recommended auth options:

- Yale / Google OAuth if feasible
- magic-link login if institutional SSO is too heavy initially

---

## Safety and clinical governance

Because this is medical education, AI features need explicit guardrails.

### Required principles

- all scenarios remain faculty-authored and reviewed
- all AI outputs are educational support, not clinical advice
- AI feedback is constrained to structured, reviewable prompts
- content references should come from approved faculty-reviewed materials
- educators should be able to audit what the AI showed learners

### Recommendation

The first AI features should be:

- post-scenario debriefs
- educator summaries

The riskiest features to delay until later:

- freeform live AI scenario steering
- unconstrained AI-generated physiology
- open-ended unreviewed treatment recommendations

---

## Recommended roadmap

## Phase 1: strengthen current prototype

- keep current no-login public site
- improve analytics
- refine scenarios and teaching content
- continue faculty review

## Phase 2: learner accounts + saved progress

- add student login
- save attempts and performance
- basic student dashboard
- basic instructor dashboard

## Phase 3: structured AI debriefs

- post-scenario learner debriefs
- faculty-reviewed prompt design
- recommended next scenarios

## Phase 4: educator AI insights

- cohort summaries
- misconception clustering
- scenario difficulty summaries
- assignment suggestions

## Phase 5: broader multi-institution pilot

- custom domain
- onboarding playbook
- external partner testing
- institution-specific customization

---

## What I would recommend doing first

If this were my project, I would prioritize in this order:

1. keep the public prototype alive and improving
2. build authentication and data persistence
3. create a very simple student dashboard
4. create a simple instructor dashboard
5. add structured AI debriefs only after enough tracked attempt data exists

That sequence gives you:

- the least technical risk
- the clearest faculty validation path
- better educational safety
- a realistic pilot strategy

---

## What this requires from you

Before implementation, you would need to decide:

### Product decisions

- Should student login be optional or eventually required for assigned use?
- Should educators see identifiable learner data or only de-identified summaries?
- What metrics matter most for success?

### Institutional decisions

- Is Yale login/SSO available or do you want simpler email auth first?
- What privacy/IRB boundaries apply to learner performance tracking?
- What content sources can be used for RAG and AI feedback?

### Technical decisions

- Supabase vs Firebase vs custom backend
- whether to keep frontend lightweight or eventually migrate to React/Next.js
- which AI provider to use

---

## Final recommendation in one sentence

Build this as a **hybrid public + authenticated learning platform** with deterministic faculty-authored simulation, optional student accounts for longitudinal progress, separate instructor dashboards for cohort analytics, and carefully bounded AI used first for debriefs and insights rather than for unconstrained simulation control.

---
---

# Lean MVP Roadmap — Step-by-Step Implementation Guide

This section is written as a **sequential, agent-executable build plan**. Each milestone is a discrete unit of work that produces a visible, testable result. An AI coding agent should complete each milestone fully before moving to the next. The user should be able to see and verify progress after every milestone.

**Important constraints for the implementing agent:**

- Do not refactor or break the existing public site. It must remain fully functional at all times.
- Each milestone should be committable and deployable independently.
- Prefer small, working increments over large batch changes.
- Ask the user for credentials, keys, or policy decisions when you reach a step that requires them — do not guess or skip.
- The existing site lives at the repo root as static HTML/CSS/JS on GitHub Pages. New platform features will coexist alongside it.

---

## Milestone 0: Project scaffolding and backend setup

**Goal:** Set up a backend project alongside the existing static site without breaking anything.

### Steps

1. Create a `platform/` directory at the repo root. All new backend and dashboard code lives here. The existing `index.html`, `ventilator.html`, `css/`, `js/`, `images/` remain untouched.
2. Initialize a `platform/package.json` with project metadata.
3. Choose and configure **Supabase** as the backend:
   - ASK the user: "Do you have a Supabase account? If not, create one at supabase.com and create a new project. Give me the project URL and the anon (public) key."
   - Create `platform/.env.example` documenting required env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
   - Create `platform/.env` (gitignored) for the user to fill in.
   - Add `.env` to `.gitignore`.
4. Create a `platform/supabase/` folder with initial SQL migration files (can be run via Supabase dashboard or CLI):
   - `001_create_users_profile.sql` — extends Supabase auth with a `profiles` table:
     ```
     id (uuid, references auth.users)
     role (text: 'student' | 'instructor' | 'admin')
     display_name (text)
     institution (text, default 'Yale')
     training_level (text, nullable)
     created_at (timestamptz)
     ```
   - `002_create_scenario_attempts.sql`:
     ```
     id (uuid, primary key)
     user_id (uuid, references profiles, nullable for anonymous)
     scenario_id (text)
     scenario_name (text)
     started_at (timestamptz)
     completed_at (timestamptz, nullable)
     total_seconds (integer, nullable)
     completion_status (text: 'in_progress' | 'completed' | 'abandoned')
     ```
   - `003_create_step_events.sql`:
     ```
     id (uuid, primary key)
     attempt_id (uuid, references scenario_attempts)
     step_number (integer)
     answer_index (integer)
     is_correct (boolean)
     latency_seconds (integer)
     created_at (timestamptz)
     ```
   - `004_create_tutorial_events.sql`:
     ```
     id (uuid, primary key)
     user_id (uuid, references profiles, nullable)
     session_id (text)
     monitor (text)
     event_type (text: 'opened' | 'pathology_selected' | 'tab_switched' | 'closed')
     event_value (text, nullable)
     dwell_seconds (integer, nullable)
     created_at (timestamptz)
     ```
   - `005_create_ai_outputs.sql`:
     ```
     id (uuid, primary key)
     attempt_id (uuid, references scenario_attempts)
     debrief_json (jsonb)
     weak_domains (text array)
     recommended_next (text, nullable)
     created_at (timestamptz)
     ```
   - `006_row_level_security.sql`:
     - Students can read/write only their own rows.
     - Instructors can read all rows (no write to student data).
     - Anonymous users cannot read the dashboard tables.
5. Verify: user can see the `platform/` folder, the SQL files, and `.env.example`. Nothing in the public site has changed.

**Checkpoint:** User confirms Supabase project exists and SQL migrations are ready to run.

---

## Milestone 1: Authentication — student and instructor login

**Goal:** Add a login page that students and instructors can use. The public site remains accessible without login.

### Steps

1. Create `platform/auth.html` — a clean, standalone login page styled consistently with the existing site (same fonts, colors, card style).
   - Google OAuth button (if Supabase Google provider is enabled) OR email magic-link login.
   - ASK the user: "Do you want Google login, email magic-link, or both? Do you want to restrict to @yale.edu emails?"
   - On successful login, redirect students to `platform/student.html` and instructors to `platform/instructor.html` based on their `role` in the `profiles` table.
   - Include a "Continue without account" link that goes back to `index.html`.
2. Create `platform/js/supabase-client.js`:
   - Initialize the Supabase JS client (loaded from CDN: `@supabase/supabase-js`).
   - Export helper functions: `signIn()`, `signOut()`, `getUser()`, `getRole()`.
3. Create `platform/js/auth-guard.js`:
   - On page load, check if user is logged in.
   - If not, redirect to `auth.html`.
   - If logged in, check role and redirect if on wrong dashboard.
4. Add a small "Sign In" link/button to the existing site nav (both `index.html` and `ventilator.html`) that links to `platform/auth.html`. This is the only change to the public site in this milestone.
5. After first login, auto-create a row in `profiles` with `role: 'student'` (default). Instructors are promoted manually via the Supabase dashboard or a future admin tool.
6. Verify: user can open `platform/auth.html`, log in, see a placeholder page, log out, and return to the public site.

**Checkpoint:** Authentication works end-to-end. Public site unchanged except for the sign-in link.

---

## Milestone 2: Event logging from the existing site to Supabase

**Goal:** When a logged-in student uses the public site, their interactions are logged to Supabase in addition to GA4.

### Steps

1. Create `platform/js/event-logger.js`:
   - On load, check if user is authenticated (via Supabase session cookie/token).
   - If authenticated, intercept the same events that `analytics.js` tracks and ALSO write them to Supabase tables.
   - If not authenticated, do nothing (GA4 still fires as before).
   - Key events to log:
     - `scenario_started` → insert into `scenario_attempts`
     - `scenario_answer` → insert into `step_events`
     - `scenario_completed` → update `scenario_attempts` with completion
     - `monitor_tutorial_opened`, `tutorial_pathology_selected`, `etco2_tab_switched` → insert into `tutorial_events`
2. Add `<script src="platform/js/supabase-client.js">` and `<script src="platform/js/event-logger.js">` to both `index.html` and `ventilator.html`, after `analytics.js`. These scripts are no-ops for anonymous users.
3. Verify: logged-in user completes a scenario → rows appear in Supabase `scenario_attempts` and `step_events` tables. Anonymous user → no Supabase writes, GA4 still works.

**Checkpoint:** Dual logging (GA4 + Supabase for authenticated users) confirmed working.

---

## Milestone 3: Student dashboard — basic progress view

**Goal:** Logged-in students see a personal dashboard showing their scenario history and performance.

### Steps

1. Create `platform/student.html` — clean dashboard page with:
   - nav bar (site name, "Back to Simulator" link, "Sign Out" button)
   - auth guard (redirect to login if not authenticated)
2. Dashboard sections (all read from Supabase):
   - **Welcome card**: "Hello, [display_name]" with training level if set.
   - **Scenarios completed**: list of completed scenario attempts with date, scenario name, total time, and completion status.
   - **Performance summary card**:
     - total scenarios completed
     - average time to complete
     - average latency per step
   - **Recent activity**: last 5 events (scenario starts, tutorial opens) with timestamps.
3. Style consistently with existing site (use `css/variables.css` and `css/styles.css` as base, add `platform/css/dashboard.css` for dashboard-specific styles).
4. Verify: student logs in, completes a scenario on the main site, returns to dashboard, sees the attempt listed.

**Checkpoint:** Student can see their own history and basic stats.

---

## Milestone 4: Rule-based AI debrief after scenario completion

**Goal:** After completing a scenario, the student sees a structured debrief modal with coaching feedback and a micro-drill.

### Steps

1. Create `platform/js/debrief-engine.js` — a purely local, rule-based engine (no API calls):
   - Input: scenario name, step-by-step choices (index + correctness + latency), tutorial usage during the session.
   - Processing:
     - tag each step with topic domains (e.g., `airway`, `bronchospasm`, `capnography`, `hemodynamics`) using a mapping object defined per scenario.
     - compute: weak domains (incorrect + slow), strong domains (correct + fast), overall performance tier.
   - Output: a structured JSON object:
     ```json
     {
       "summary": "one sentence overall assessment",
       "strengths": ["...", "..."],
       "gaps": ["...", "..."],
       "teaching_points": ["...", "...", "..."],
       "next_drill": {
         "prompt": "question text",
         "choices": [{"text": "..."}, {"text": "..."}],
         "correct_index": 0,
         "explanation": "..."
       }
     }
     ```
2. Define the topic/domain tags and micro-drill bank for each existing scenario in a new `platform/js/debrief-data.js` file. Each scenario gets:
   - step-level domain tags
   - 3-5 micro-drill questions per domain
   - teaching point library
3. Integrate into the ventilator page:
   - After `renderScenResolution()` fires, if the user is authenticated, call the debrief engine and show a "Debrief" modal with the results.
   - If the user is not authenticated, show a softer prompt: "Sign in to see personalized feedback on your performance."
4. Save the debrief output to Supabase `ai_outputs` table (for later educator review).
5. Track in GA4: `debrief_opened`, `debrief_drill_answered`.
6. Verify: student completes scenario → debrief modal appears with relevant, scenario-specific coaching and a drill question.

**Checkpoint:** Rule-based debrief works for all existing scenarios. No external API calls.

---

## Milestone 5: Instructor dashboard — individual and cohort views

**Goal:** Instructors log in and see learner performance data, both per-student and in aggregate.

### Steps

1. Create `platform/instructor.html` — protected dashboard (auth guard checks `role === 'instructor'`).
2. **Cohort overview tab**:
   - Active learners (unique users with attempts in selected date range)
   - Total scenario completions
   - Average completion time by scenario (table)
   - Completion rate by scenario (started vs completed)
   - Step difficulty heatmap: rows = scenarios, columns = step numbers, cells = median latency (color-coded)
   - Most common wrong answers per step (top 1-2)
   - Tutorial engagement: % of sessions that opened each monitor tutorial
   - Least-used features list
3. **Individual learner tab**:
   - Dropdown or search to select a student
   - That student's scenario history (same as their own dashboard view)
   - Their debrief outputs (from `ai_outputs`)
   - Their weak domains over time
   - Timeline of activity
4. **Export tab**:
   - CSV download of scenario attempts + step events for a date range
   - CSV download of tutorial events
5. All queries use Supabase client with instructor-level RLS (read all rows).
6. Style consistently with the existing site.
7. Verify: instructor logs in, sees aggregate data, can drill into a specific student, can export CSV.

**Checkpoint:** Instructor dashboard is functional with real data from pilot users.

---

## Milestone 6: LLM-powered debrief upgrade (requires API key)

**Goal:** Replace or augment the rule-based debrief with a more nuanced LLM-generated debrief.

### Steps

1. ASK the user: "Which LLM provider do you want to use (OpenAI, Anthropic, etc.)? Please provide or set up an API key."
2. Create a **serverless function** (e.g., Supabase Edge Function, or Cloudflare Worker, or Vercel Function):
   - Accepts: structured attempt summary JSON (scenario name, choices, latencies, tutorial usage). No raw user text.
   - Calls the LLM with a carefully constructed system prompt that:
     - identifies itself as an anesthesia education tutor
     - is constrained to respond only in the structured JSON schema
     - references the scenario's learning objectives
     - does not give clinical advice for real patients
   - Returns: structured debrief JSON (same schema as rule-based engine).
3. Update `platform/js/debrief-engine.js` to:
   - Try the LLM endpoint first.
   - Fall back to rule-based if the endpoint fails or is unavailable.
4. Save LLM debrief output to `ai_outputs` with a flag indicating `source: 'llm'` vs `source: 'rule_based'`.
5. Add cost tracking: log token usage per call so you can monitor spend.
6. Verify: student completes scenario → receives LLM-quality debrief. If API is down, rule-based fires seamlessly.

**Checkpoint:** LLM debrief works, with graceful fallback and cost visibility.

---

## Milestone 7: AI-powered educator insights

**Goal:** Instructors see AI-generated summaries of cohort learning trends.

### Steps

1. Create a **serverless function** for educator summaries:
   - Accepts: aggregated cohort data (scenario completion rates, common errors, latency distributions) for a date range.
   - Calls LLM with an educator-facing prompt asking for:
     - plain-language summary of cohort performance
     - top 3 areas where students struggle
     - suggested teaching interventions
     - comparison to prior period if data exists
   - Returns: structured summary JSON.
2. Add an "AI Summary" card to the instructor dashboard cohort view:
   - "Generate summary for [date range]" button.
   - Renders the LLM response in a clean card.
   - Cached per date range to avoid redundant API calls.
3. Save summaries to a new `educator_summaries` table for historical reference.
4. Verify: instructor clicks "Generate summary" → sees a useful, readable summary of their cohort's recent performance.

**Checkpoint:** Instructor AI insights working and useful.

---

## Milestone 8: RAG-enabled teaching chatbot

**Goal:** Students can ask questions and receive answers grounded in faculty-approved content.

### Steps

1. ASK the user: "What approved reference materials should the chatbot draw from? (e.g., scenario teaching points, drug data from data.js, specific textbook excerpts, faculty-written explanations)"
2. Create a content store:
   - Extract and structure approved content into a searchable format (e.g., JSON documents or a vector store via Supabase pgvector).
   - Sources: scenario explanations, drug data, monitor tutorial teaching points, faculty-provided references.
3. Create a serverless RAG endpoint:
   - Accepts: student question + current context (which page, which scenario, which tutorial).
   - Retrieves top-k relevant content chunks.
   - Calls LLM with retrieved context + a strict system prompt:
     - only answer from retrieved content
     - cite which source the answer came from
     - if unsure, say so and suggest asking faculty
     - never give clinical advice for real patients
   - Returns: answer text + source citations.
4. Add a chat interface to the student experience:
   - Small floating chat button (similar to the existing "Ask AI" concept).
   - Opens a chat panel.
   - Only available to authenticated users.
5. Log all questions and answers to a `chatbot_logs` table for faculty review.
6. Verify: student asks "Why does bronchospasm cause a shark-fin on capnography?" → gets a grounded, cited answer.

**Checkpoint:** RAG chatbot functional with faculty-approved content. All interactions logged and auditable.

---

## Milestone 9: Polish, deploy, and pilot prep

**Goal:** Everything is production-ready for a structured pilot.

### Steps

1. Custom domain setup (user provides domain name → configure DNS + GitHub Pages / hosting).
2. Update all canonical URLs, OG tags, sitemap, robots.txt to the new domain.
3. Security audit:
   - Verify RLS policies
   - Verify no API keys are exposed client-side
   - Verify auth redirects work correctly
   - Test role separation (student cannot access instructor dashboard)
4. Add a consent/privacy notice on first login explaining what data is collected and how it is used.
5. Create an onboarding guide for:
   - students (how to create account, use scenarios, view dashboard)
   - instructors (how to access dashboard, interpret metrics, export data)
6. Performance check: verify page load times, Supabase query latency, LLM response times are acceptable.
7. Final commit, deploy, and confirm everything works on the live domain.

**Checkpoint:** Platform is pilot-ready. Hand off to faculty for review before student rollout.

---

## Implementation order summary

| Order | Milestone | Depends on | Visible result |
|-------|-----------|------------|----------------|
| 0 | Project scaffolding + DB schema | Supabase account | `platform/` folder, SQL files |
| 1 | Authentication | M0 | Login page, sign-in link on public site |
| 2 | Event logging to Supabase | M1 | Scenario data in DB for logged-in users |
| 3 | Student dashboard | M2 | Students see their own history |
| 4 | Rule-based AI debrief | M2 | Post-scenario coaching modal |
| 5 | Instructor dashboard | M2 | Educator analytics views |
| 6 | LLM debrief upgrade | M4 + API key | Higher-quality coaching |
| 7 | Educator AI insights | M5 + API key | AI cohort summaries |
| 8 | RAG chatbot | M6 + content | Grounded teaching Q&A |
| 9 | Polish + deploy | All above | Pilot-ready platform |

Each milestone is independently testable and deployable. The user should verify the checkpoint before the agent proceeds to the next milestone.
