import Link from "next/link";
import { MessageSquare, TriangleAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { providerStatus } from "@/lib/ai/provider";
import { PROVIDERS } from "@/lib/ai/catalog";
import { listMessages, listThreads } from "@/lib/ai/threads";
import { formatDateTime } from "@/lib/format";
import AssistantChat from "@/components/admin/assistant/AssistantChat";
import { Card, CardHeader, EmptyState, PageHeader, buttonStyles } from "@/components/admin/ui";

export const metadata = { title: "Assistant" };

export default async function AssistantPage({
  searchParams,
}: PageProps<"/admin/assistant">) {
  const { thread } = await searchParams;
  const requested = typeof thread === "string" ? thread : null;

  // The session is needed before the thread can be read, but the provider
  // status is not -- so it goes out alongside rather than after.
  const [user, ai] = await Promise.all([getCurrentUser(), providerStatus()]);
  const adminId = user?.id ?? "";

  const [threads, messages] = await Promise.all([
    listThreads(adminId),
    requested ? listMessages(requested, adminId) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        title="Assistant"
        subtitle="Ask about your shop in plain language"
        breadcrumb={["Assistant"]}
      />

      {!ai.hasKey ? (
        <div className="mb-5 flex flex-col gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2.5 text-[13px] text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">No AI key yet.</strong> Pick a provider and paste
              a key in Settings — {PROVIDERS[ai.provider].label} is selected. Until then the
              assistant cannot answer.
            </span>
          </p>
          <Link
            href="/admin/settings"
            className={`${buttonStyles.secondary} shrink-0 justify-center`}
          >
            Add a key
          </Link>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <Card>
            <AssistantChat
              initialMessages={messages}
              initialThreadId={requested}
              demoMode={!ai.hasKey}
            />
          </Card>
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-4">
          <Card>
            <CardHeader title="Conversations" subtitle="Yours only" />
            {threads.length === 0 ? (
              <EmptyState title="Nothing yet" detail="Your questions will be kept here." />
            ) : (
              <ul className="space-y-1.5">
                {threads.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      href={`/admin/assistant?thread=${entry.id}`}
                      className={`block rounded-xl px-3 py-2.5 transition hover:bg-neutral-50 ${
                        entry.id === requested ? "bg-brand-tint/50" : ""
                      }`}
                    >
                      <span className="flex items-start gap-2">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-300" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-neutral-700">
                            {entry.title}
                          </span>
                          <span className="text-[11px] text-neutral-400">
                            {formatDateTime(entry.updatedAt)}
                          </span>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {requested ? (
              <Link
                href="/admin/assistant"
                className={`${buttonStyles.secondary} mt-3 w-full justify-center`}
              >
                New conversation
              </Link>
            ) : null}
          </Card>

          <Card>
            <CardHeader title="What it can see" />
            <p className="text-[12.5px] leading-relaxed text-neutral-500">
              Orders, products, stock, categories, customer totals and your marketing campaigns
              — read from this shop&apos;s own database.
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-500">
              It cannot see a customer&apos;s name, phone number or address, and it cannot change
              anything. When it suggests work, that suggestion sits there until you act on it.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
