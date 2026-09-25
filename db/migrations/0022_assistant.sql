-- The admin assistant's memory.
--
-- The Marketing Command Center answers one kind of question and writes its
-- reasoning into `marketing_runs`. This is the general one: the owner asks
-- whatever they want about the shop -- why sales dropped, which product is
-- stuck, what happened to an order -- and keeps asking follow-ups, which only
-- works if the conversation survives a page reload.
--
-- Two tables rather than one blob per thread, because the interesting
-- question later is "what did it tell me, and what was it looking at when it
-- said that?". `data_used` records which shop readings were fetched for an
-- answer, so a wrong answer can be traced to the figures behind it instead of
-- being re-run and hoped over.
--
-- Nothing here stores a customer's name, number or address. The assistant
-- reads aggregates, and what it read is recorded by *name* -- "top_products",
-- "low_stock" -- not by copying rows into a log that would then outlive the
-- retention rules of the tables they came from.

CREATE TABLE IF NOT EXISTS assistant_threads (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_by TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assistant_threads_owner
  ON assistant_threads (created_by, updated_at DESC);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                 -- user|assistant
  content TEXT NOT NULL,
  -- Which readings were fetched to answer, as a JSON array of names. Null on
  -- a question, and on an answer that needed nothing looked up.
  data_used TEXT,
  -- What the assistant proposed doing, when it proposed anything. Proposals
  -- are inert until a human approves them; this column is the record of what
  -- was offered, never an instruction anything acts on by itself.
  proposal_json TEXT,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_assistant_messages_thread
  ON assistant_messages (thread_id, created_at ASC);
