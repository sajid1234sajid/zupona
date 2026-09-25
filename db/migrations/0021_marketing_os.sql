-- The Marketing OS: what the AI proposed, what a human approved, what ran.
--
-- The admin can already merchandise the shop -- banners, flash sales, coupons
-- -- but everything about *advertising* it lived outside the system, in Ads
-- Manager and in whoever remembered which creative worked last time. These
-- tables are that missing half: an instruction in plain language becomes a
-- run, a run becomes tasks, tasks produce a campaign and its creatives, a
-- human approves it, and what happened afterwards comes back as metrics that
-- the next plan can read.
--
-- Three rules are built into the shape rather than left to the code.
--
-- **Nothing spends money without a row saying who allowed it.** A campaign
-- reaches `live` only through `marketing_approvals`, and the approval records
-- the budget that was on screen when the button was pressed -- so an approval
-- cannot be reused for a plan that has since grown more expensive.
--
-- **Demo data never mixes with real.** `is_demo` sits on every table that
-- carries a number anyone might report on, because a shop trying the system
-- out must not find invented spend averaged into its actual ROAS.
--
-- **An external action is only "done" once it has been verified.** Campaigns
-- and creatives keep `external_id` (what Meta called it) separate from
-- `status`, so a request that was sent but never confirmed stays visible as
-- exactly that instead of being quietly counted as launched.
--
-- Money is whole Taka, as everywhere else in this schema. Meta reports spend
-- with decimals, so ingestion rounds to the nearest Taka; at daily
-- granularity that is under half a Taka a day and keeps CPA and ROAS
-- arithmetic in the same units as `orders.total`.

/* -------------------------------------------------------------------------- */
/* AI runs and the tasks they break into                                      */
/* -------------------------------------------------------------------------- */

-- One invocation of one agent. The operator's instruction creates a run; so
-- does a nightly report. `input_summary` is the human sentence behind it and
-- is what the activity log shows, while `output_json` holds the structured
-- result the next stage consumes.
--
-- Model output is untrusted input: it is stored as text here and validated
-- before anything acts on it, never executed or interpolated into a query.
CREATE TABLE IF NOT EXISTS marketing_runs (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,           -- command|research|strategy|creative|analysis|report
  status TEXT NOT NULL DEFAULT 'queued', -- queued|running|completed|failed|cancelled
  model TEXT,                         -- the model id that answered, for accountability
  input_summary TEXT NOT NULL,
  input_reference TEXT,               -- product id, campaign id, whatever it was about
  output_json TEXT,
  error TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_marketing_runs_created ON marketing_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_runs_status ON marketing_runs (status, created_at DESC);

-- A run's plan, one row per step, in `seq` order.
--
-- Tasks exist because a whole plan cannot be produced inside one request: a
-- Worker has a CPU budget, and research plus strategy plus five creative
-- briefs is several model calls. Each task is driven forward by its own
-- request and leaves its result here, so a refreshed tab picks the plan up
-- where it stopped rather than starting the spending decision again.
CREATE TABLE IF NOT EXISTS marketing_tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES marketing_runs(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  kind TEXT NOT NULL,                 -- inspect_product|review_history|research|strategy|creatives|draft_campaign|request_approval|publish|monitor|report
  title TEXT NOT NULL,                -- what the operator sees: "Create 5 creative briefs"
  status TEXT NOT NULL DEFAULT 'queued', -- queued|running|completed|failed|skipped
  output_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_tasks_seq ON marketing_tasks (run_id, seq);
CREATE INDEX IF NOT EXISTS idx_marketing_tasks_status ON marketing_tasks (status);

/* -------------------------------------------------------------------------- */
/* Campaigns and creatives                                                    */
/* -------------------------------------------------------------------------- */

-- A campaign is a draft until somebody approves it, and `status` is the only
-- thing that decides whether money can be spent against it.
--
-- `product_id` is nullable and ON DELETE SET NULL: a deleted product must not
-- take its campaign's spending history with it, because the money was still
-- spent and still belongs in the totals.
--
-- `execution_key` is what makes Execute safe to press twice. The client sends
-- the same key for the same approved plan, and the unique index below refuses
-- the second attempt at the database rather than trusting the button to be
-- disabled in time.
CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES marketing_runs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT 'purchase', -- purchase|traffic|awareness|engagement
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft|awaiting_approval|approved|publishing|live|paused|completed|failed|rejected
  platform TEXT NOT NULL DEFAULT 'meta', -- meta|facebook|instagram|messenger
  budget_total INTEGER NOT NULL DEFAULT 0,  -- whole Taka, the ceiling that was approved
  budget_daily INTEGER,                     -- whole Taka, NULL when only a total was set
  starts_at TEXT,
  ends_at TEXT,
  audience_json TEXT,                 -- targeting as proposed; shape belongs to the provider
  utm_campaign TEXT,                  -- generated, never typed by hand
  external_id TEXT,                   -- Meta's campaign id, set only after verification
  external_error TEXT,                -- why the last publish attempt failed, for Retry
  execution_key TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_campaigns_execution
  ON marketing_campaigns (execution_key) WHERE execution_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_status
  ON marketing_campaigns (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_campaigns_product ON marketing_campaigns (product_id);

-- One creative concept: the angle, the hook, and the words that carry them.
--
-- Kept as structured columns rather than a blob because the whole point of
-- the memory layer is to ask "which angle sold" later, and that question is
-- unanswerable if the angle only exists inside a paragraph of generated prose.
CREATE TABLE IF NOT EXISTS marketing_creatives (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  run_id TEXT REFERENCES marketing_runs(id) ON DELETE SET NULL,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  label TEXT NOT NULL,                -- "Creative #03", stable in conversation
  angle TEXT NOT NULL,                -- problem_solution|comfort|price|social_proof|demonstration|...
  hook TEXT NOT NULL,
  headline TEXT,
  body TEXT,
  script TEXT,
  visual_direction TEXT,
  cta TEXT,
  format TEXT NOT NULL DEFAULT 'image', -- image|video|carousel
  status TEXT NOT NULL DEFAULT 'draft', -- draft|generating|ready|approved|rejected|published
  asset_url TEXT,                     -- R2 key or provider URL once an asset exists
  utm_content TEXT,
  external_id TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_creatives_campaign ON marketing_creatives (campaign_id);
CREATE INDEX IF NOT EXISTS idx_marketing_creatives_status ON marketing_creatives (status);

/* -------------------------------------------------------------------------- */
/* What actually happened                                                     */
/* -------------------------------------------------------------------------- */

-- One row per campaign (or creative) per day. Re-pulling a day must correct
-- it rather than add to it, so the unique index below is what the ingestion
-- upserts against -- Meta revises recent days, and a shop that appended would
-- watch yesterday's spend double every time it refreshed.
--
-- `revenue` and `purchases` are what the platform attributes. They will not
-- always equal what `orders` holds, and that difference is a real finding
-- worth showing rather than a bug worth hiding.
CREATE TABLE IF NOT EXISTS marketing_metrics (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  creative_id TEXT REFERENCES marketing_creatives(id) ON DELETE CASCADE,
  stat_date TEXT NOT NULL,            -- YYYY-MM-DD
  spend INTEGER NOT NULL DEFAULT 0,   -- whole Taka
  impressions INTEGER NOT NULL DEFAULT 0,
  reach INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  add_to_cart INTEGER NOT NULL DEFAULT 0,
  checkouts INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  revenue INTEGER NOT NULL DEFAULT 0, -- whole Taka
  frequency REAL,                     -- fractional by nature; fatigue watches it climb
  is_demo INTEGER NOT NULL DEFAULT 0,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_metrics_day
  ON marketing_metrics (campaign_id, IFNULL(creative_id, ''), stat_date);
CREATE INDEX IF NOT EXISTS idx_marketing_metrics_date ON marketing_metrics (stat_date DESC);

/* -------------------------------------------------------------------------- */
/* Experiments, approvals, memory, connections                                */
/* -------------------------------------------------------------------------- */

-- Marketing as experiment: a hypothesis, one variable, and a metric agreed in
-- advance. `conclusion` stays NULL until there is enough data to fill it,
-- which is the whole reason it is a column and not a paragraph -- a winner
-- declared early is the most expensive mistake this system can make.
CREATE TABLE IF NOT EXISTS marketing_experiments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  hypothesis TEXT NOT NULL,
  variable TEXT NOT NULL,
  control_creative_id TEXT REFERENCES marketing_creatives(id) ON DELETE SET NULL,
  variant_creative_id TEXT REFERENCES marketing_creatives(id) ON DELETE SET NULL,
  success_metric TEXT NOT NULL DEFAULT 'cost_per_purchase',
  budget INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned', -- planned|running|concluded|abandoned
  conclusion TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  concluded_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_marketing_experiments_campaign
  ON marketing_experiments (campaign_id);

-- The record of a human saying yes, and to what exactly.
--
-- `budget_snapshot` is not decoration. An approval is permission to spend a
-- specific amount, so publishing compares the campaign's budget against this
-- number and refuses if the plan has changed since -- otherwise "approve
-- ৳2,000" quietly becomes permission to spend ৳20,000.
CREATE TABLE IF NOT EXISTS marketing_approvals (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  decision TEXT NOT NULL,             -- approved|rejected
  budget_snapshot INTEGER NOT NULL,   -- whole Taka shown on the approval screen
  creative_count INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_approvals_campaign
  ON marketing_approvals (campaign_id, decided_at DESC);

-- What this shop has learned, in a form the next plan can actually read.
--
-- Deliberately narrow: a product, an angle, what it cost, what it returned,
-- and one sentence of conclusion. Anything vaguer would be a diary the
-- planner cannot use.
CREATE TABLE IF NOT EXISTS marketing_knowledge (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES marketing_campaigns(id) ON DELETE SET NULL,
  creative_id TEXT REFERENCES marketing_creatives(id) ON DELETE SET NULL,
  angle TEXT,
  audience_note TEXT,
  spend INTEGER NOT NULL DEFAULT 0,
  purchases INTEGER NOT NULL DEFAULT 0,
  revenue INTEGER NOT NULL DEFAULT 0,
  conclusion TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'hypothesis', -- confirmed|supported|hypothesis|low
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketing_knowledge_product ON marketing_knowledge (product_id);

-- One row per connected advertising account.
--
-- No access token lives here. Tokens are secrets and belong with the other
-- secrets in `site_settings`, redacted from the audit log; this table holds
-- only the public half -- which account, which page, whether it still works
-- and when it was last checked -- so the Settings screen can answer "are we
-- connected?" without reading a credential to do it.
CREATE TABLE IF NOT EXISTS marketing_integrations (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,             -- meta
  ad_account_id TEXT,
  page_id TEXT,
  instagram_id TEXT,
  account_name TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected', -- disconnected|connected|error
  last_error TEXT,
  last_checked_at TEXT,
  connected_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_integrations_provider
  ON marketing_integrations (provider);
