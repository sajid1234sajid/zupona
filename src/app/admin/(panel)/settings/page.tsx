import { ScrollText } from "lucide-react";
import { listAuditLog } from "@/lib/admin";
import { getShopSettings } from "@/lib/shopSettings";
import { getCurrentUser } from "@/lib/session";
import { formatDateTime } from "@/lib/format";
import { PasswordForm, StoreSettingsForm } from "@/components/admin/SettingsForms";
import { Avatar, Card, CardHeader, PageHeader, StatusPill } from "@/components/admin/ui";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [settings, audit, user] = await Promise.all([
    getShopSettings(),
    listAuditLog({ limit: 25 }),
    getCurrentUser(),
  ]);

  return (
    <>
      <PageHeader
        title="Settings"
        subtitle="Store configuration and your admin account"
        breadcrumb={["Settings"]}
      />

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <StoreSettingsForm settings={settings} />
        </div>

        <div className="min-w-0 space-y-4 xl:col-span-4">
          <Card>
            <CardHeader title="Signed in as" />
            <div className="flex items-center gap-3">
              <Avatar src={user?.avatarUrl} name={user?.name ?? "Admin"} size={44} />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-semibold text-neutral-900">
                  {user?.name ?? "Admin"}
                </p>
                <p className="truncate text-[12px] text-neutral-500">{user?.email ?? "—"}</p>
                <div className="mt-1">
                  <StatusPill status={user?.role ?? "admin"} />
                </div>
              </div>
            </div>
          </Card>

          <PasswordForm />

          <Card>
            <CardHeader
              title="Audit Log"
              subtitle="Every privileged change, newest first"
            />
            {audit.length === 0 ? (
              <p className="flex items-center justify-center gap-2 py-8 text-sm text-neutral-400">
                <ScrollText className="h-4 w-4" />
                Nothing recorded yet.
              </p>
            ) : (
              <ul className="max-h-96 space-y-2.5 overflow-y-auto">
                {audit.map((entry) => (
                  <li key={entry.id} className="border-b border-neutral-50 pb-2.5 last:border-0">
                    <p className="truncate text-[12px] font-semibold text-neutral-800">
                      {entry.action}
                    </p>
                    <p className="truncate text-[11px] text-neutral-400">
                      {entry.adminName ?? "System"} · {entry.entityType} ·{" "}
                      {formatDateTime(entry.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
