import { BookOpen } from "lucide-react";
import { getGuideSections } from "@/lib/systemGuide";
import { formatDateTime } from "@/lib/format";
import { Card, PageHeader } from "@/components/admin/ui";

export const metadata = { title: "System Guide" };

/** Typography for the rendered Markdown. Written as variants on the wrapper
 * rather than a stylesheet so the guide's look stays with the guide and
 * nothing it does can leak into the rest of the panel. Wide tables and the
 * diagram scroll sideways on a phone instead of being squeezed unreadable. */
const PROSE = [
  "text-[14px] leading-relaxed text-neutral-700",
  "[&_p]:my-3 [&_strong]:font-semibold [&_strong]:text-neutral-900",
  "[&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:text-neutral-900",
  "[&_a]:font-medium [&_a]:text-brand [&_a]:underline-offset-2 hover:[&_a]:underline",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5",
  "[&_ol]:my-3 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-5",
  "[&_li>input]:mr-1.5",
  "[&_code]:rounded [&_code]:bg-neutral-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[12.5px] [&_code]:text-neutral-800",
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-neutral-900 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:text-neutral-100",
  "[&_table]:my-4 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-[13px]",
  "[&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-neutral-200 [&_th]:bg-neutral-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-neutral-800",
  "[&_td]:border-b [&_td]:border-neutral-100 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top",
  "[&_.guide-diagram]:my-4 [&_.guide-diagram]:overflow-x-auto [&_.guide-diagram_svg]:h-auto [&_.guide-diagram_svg]:w-full [&_.guide-diagram_svg]:min-w-[680px]",
].join(" ");

export default async function SystemGuidePage() {
  const sections = await getGuideSections();

  const latest = sections.reduce<(typeof sections)[number] | null>(
    (newest, section) => (!newest || section.updatedAt > newest.updatedAt ? section : newest),
    null
  );

  return (
    <>
      <PageHeader
        title="System Guide"
        subtitle="How Zupona works, what it can do, and what has changed"
        breadcrumb={["Settings", "System Guide"]}
      />

      {sections.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <BookOpen className="h-6 w-6 text-neutral-300" />
            <p className="text-sm text-neutral-500">The guide has not been written yet.</p>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-12">
          <aside className="min-w-0 xl:order-2 xl:col-span-3">
            <Card className="xl:sticky xl:top-20">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Contents
              </p>
              <ol className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px] sm:grid-cols-3 xl:grid-cols-1">
                {sections.map((section) => (
                  <li key={section.slug} className="min-w-0">
                    <a
                      href={`#${section.slug}`}
                      className="block truncate rounded-md py-1 text-neutral-600 transition hover:text-brand"
                    >
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
              {latest ? (
                <p className="mt-3 border-t border-neutral-100 pt-3 text-[11px] leading-snug text-neutral-400">
                  Last updated {formatDateTime(latest.updatedAt)}
                  {latest.updatedBy ? ` by ${latest.updatedBy}` : ""}
                </p>
              ) : null}
            </Card>
          </aside>

          <div className="min-w-0 space-y-5 xl:order-1 xl:col-span-9">
            {sections.map((section) => (
              <Card key={section.slug}>
                <section id={section.slug} className="scroll-mt-20">
                  <h2 className="text-lg font-bold text-neutral-900">{section.title}</h2>
                  <div className={PROSE} dangerouslySetInnerHTML={{ __html: section.html }} />
                </section>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
