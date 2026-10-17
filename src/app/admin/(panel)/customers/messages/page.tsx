import Link from "next/link";
import { MessageCircle, Phone, ThumbsDown, ThumbsUp } from "lucide-react";
import { requireStaff } from "@/lib/admin";
import { faqScores, listContactMessages } from "@/lib/supportFeedback";
import { formatDateTime } from "@/lib/format";
import { buttonStyles, Card, CardHeader, EmptyState, PageHeader, StatusPill } from "@/components/admin/ui";
import { markHandledAction } from "./actions";

export const metadata = { title: "Messages" };

const FILTERS = [
  { key: "new", label: "New" },
  { key: "handled", label: "Handled" },
  { key: "all", label: "All" },
] as const;

/** What people sent through the contact form, newest first, and which help
 * answers they found unhelpful. */
export default async function MessagesPage(props: PageProps<"/admin/customers/messages">) {
  await requireStaff();
  const params = await props.searchParams;
  const raw = Array.isArray(params.show) ? params.show[0] : params.show;
  const show = FILTERS.find((filter) => filter.key === raw)?.key ?? "new";
  const [messages, scores] = await Promise.all([listContactMessages(show), faqScores(15)]);

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle="Contact form messages, and how helpful the help-centre answers are"
        breadcrumb={["Customers", "Messages"]}
        action={
          <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
            {FILTERS.map((filter) => (
              <Link
                key={filter.key}
                href={filter.key === "new" ? "?" : `?show=${filter.key}`}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  filter.key === show ? "bg-white text-brand shadow-sm" : "text-neutral-500"
                }`}
              >
                {filter.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <Card>
              <EmptyState title={show === "new" ? "No new messages" : "No messages"} detail="Messages from the Contact page appear here." />
            </Card>
          ) : (
            messages.map((message) => {
              const digits = message.phone.replace(/\D/g, "");
              return (
                <Card key={message.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-neutral-800">{message.name}</p>
                      <p className="text-xs text-neutral-500">
                        {message.phone}
                        {message.orderNumber ? ` · order ${message.orderNumber}` : ""} · {formatDateTime(message.createdAt)}
                      </p>
                    </div>
                    <StatusPill status={message.status === "new" ? "pending" : "approved"} label={message.status === "new" ? "New" : "Handled"} />
                  </div>
                  <p className="mt-3 whitespace-pre-line text-[13.5px] text-neutral-700">{message.message}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a href={`https://wa.me/${digits.startsWith("880") ? digits : `88${digits}`}`} target="_blank" rel="noopener noreferrer" className={`${buttonStyles.secondary} !py-2`}>
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                    <a href={`tel:${message.phone}`} className={`${buttonStyles.secondary} !py-2`}>
                      <Phone className="h-4 w-4" /> Call
                    </a>
                    <form action={markHandledAction}>
                      <input type="hidden" name="id" value={message.id} />
                      <input type="hidden" name="handled" value={message.status === "new" ? "1" : "0"} />
                      <button type="submit" className={`${message.status === "new" ? buttonStyles.primary : buttonStyles.ghost} !py-2`}>
                        {message.status === "new" ? "Mark handled" : "Mark as new"}
                      </button>
                    </form>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <Card>
          <CardHeader title="Help answers" subtitle="Least helpful first: worth rewriting" />
          {scores.length === 0 ? (
            <EmptyState title="No votes yet" detail="Shoppers vote Yes / No under each answer on the Help page." />
          ) : (
            <ul className="space-y-2.5">
              {scores.map((score) => (
                <li key={score.question} className="text-[13px]">
                  <p className="text-neutral-700">{score.question}</p>
                  <p className="mt-0.5 flex gap-3 text-xs text-neutral-500">
                    <span className="flex items-center gap-1"><ThumbsUp className="h-3.5 w-3.5" /> {score.yes}</span>
                    <span className="flex items-center gap-1 text-red-600"><ThumbsDown className="h-3.5 w-3.5" /> {score.no}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
