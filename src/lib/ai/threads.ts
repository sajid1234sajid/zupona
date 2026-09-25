/** Conversations with the assistant: storing them, and reading them back.
 *
 * Threads belong to the person who started them. Every read below is scoped by
 * `created_by`, not merely ordered by it -- a thread id is a guessable enough
 * thing that "nobody would try" is not a boundary, and one admin's questions
 * about the shop's takings are not another's to read. */

import { getDB } from "@/lib/db";

export interface ThreadMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  readingsUsed: string[];
  proposals: { summary: string; detail: string; area: string }[];
  createdAt: string;
}

export interface ThreadSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** Starts a thread, titled from the first thing asked.
 *
 * The title is the question trimmed rather than a second model call: it is a
 * label in a list, and paying for a model to write one would be spending real
 * money on a nicety. */
export async function createThread(question: string, adminId: string): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  const title = question.trim().slice(0, 80) || "New conversation";

  await db
    .prepare("INSERT INTO assistant_threads (id, title, created_by) VALUES (?, ?, ?)")
    .bind(id, title, adminId)
    .run();

  return id;
}

/** Confirms this thread is the caller's before anything is read or written. */
export async function ownsThread(threadId: string, adminId: string): Promise<boolean> {
  const db = await getDB();
  const row = await db
    .prepare("SELECT id FROM assistant_threads WHERE id = ? AND created_by = ?")
    .bind(threadId, adminId)
    .first<{ id: string }>();
  return Boolean(row);
}

export async function addMessage(
  threadId: string,
  message: {
    role: "user" | "assistant";
    content: string;
    readingsUsed?: string[];
    proposals?: unknown;
    model?: string | null;
    inputTokens?: number;
    outputTokens?: number;
  }
): Promise<void> {
  const db = await getDB();

  await db.batch([
    db
      .prepare(
        `INSERT INTO assistant_messages
           (id, thread_id, role, content, data_used, proposal_json, model,
            input_tokens, output_tokens)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        crypto.randomUUID(),
        threadId,
        message.role,
        message.content,
        message.readingsUsed?.length ? JSON.stringify(message.readingsUsed) : null,
        message.proposals ? JSON.stringify(message.proposals) : null,
        message.model ?? null,
        message.inputTokens ?? null,
        message.outputTokens ?? null
      ),
    // So the thread list sorts by the last thing said rather than by when it
    // was opened.
    db
      .prepare("UPDATE assistant_threads SET updated_at = datetime('now') WHERE id = ?")
      .bind(threadId),
  ]);
}

export async function listMessages(
  threadId: string,
  adminId: string
): Promise<ThreadMessage[]> {
  if (!(await ownsThread(threadId, adminId))) return [];

  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, role, content, data_used, proposal_json, created_at
       FROM assistant_messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT 200`
    )
    .bind(threadId)
    .all<{
      id: string;
      role: string;
      content: string;
      data_used: string | null;
      proposal_json: string | null;
      created_at: string;
    }>();

  return results.map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
    readingsUsed: parseArray(row.data_used),
    proposals: parseProposals(row.proposal_json),
    createdAt: row.created_at,
  }));
}

export async function listThreads(adminId: string, limit = 20): Promise<ThreadSummary[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT id, title, updated_at FROM assistant_threads
       WHERE created_by = ? ORDER BY updated_at DESC LIMIT ?`
    )
    .bind(adminId, limit)
    .all<{ id: string; title: string; updated_at: string }>();

  return results.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
}

/** The conversation so far, flattened for the next prompt.
 *
 * Only the recent turns: a long thread would otherwise grow the bill on every
 * question, and the last few exchanges are what a follow-up actually depends
 * on. */
export async function historyFor(threadId: string, turns = 6): Promise<string> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT role, content FROM assistant_messages
       WHERE thread_id = ? ORDER BY created_at DESC LIMIT ?`
    )
    .bind(threadId, turns * 2)
    .all<{ role: string; content: string }>();

  return results
    .reverse()
    .map((row) => `${row.role === "assistant" ? "Assistant" : "Owner"}: ${row.content}`)
    .join("\n\n")
    .slice(0, 6000);
}

/** A malformed blob is not worth failing a page over -- the message still has
 * its text, which is the part the operator came to read. */
function parseArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseProposals(raw: string | null): ThreadMessage["proposals"] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as ThreadMessage["proposals"]) : [];
  } catch {
    return [];
  }
}
