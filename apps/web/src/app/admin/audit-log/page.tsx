import type { Metadata } from "next";
import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Audit Log" };

const PAGE_SIZE = 50;

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { supabase } = await requirePlatformAdmin();

  const {
    data: logs,
    count,
  } = await supabase
    .from("audit_logs")
    .select("id, org_id, actor_id, action, target_type, target_id, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  const orgIds = Array.from(
    new Set((logs ?? []).map((l) => l.org_id).filter((id): id is string => !!id)),
  );
  const actorIds = Array.from(
    new Set((logs ?? []).map((l) => l.actor_id).filter((id): id is string => !!id)),
  );

  const [{ data: orgs }, { data: actors }] = await Promise.all([
    orgIds.length > 0
      ? supabase.from("organizations").select("id, name").in("id", orgIds)
      : Promise.resolve({ data: [] }),
    actorIds.length > 0
      ? supabase.from("profiles").select("id, email").in("id", actorIds)
      : Promise.resolve({ data: [] }),
  ]);
  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const actorEmailById = new Map((actors ?? []).map((a) => [a.id, a.email]));

  const total = count ?? 0;
  const hasNext = to + 1 < total;
  const hasPrev = page > 1;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground text-sm">
          Every row is append-only, written by the same{" "}
          <code>audit_log_trigger()</code> that has logged every module&apos;s
          writes since Module 2 — this is the first UI to read it back.
          Platform-level actions (model/router/template changes) show a blank
          organization, matching <code>audit_logs.org_id is null</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {total} row{total === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-muted-foreground border-b text-left text-xs uppercase">
                <tr>
                  <th className="px-4 py-2 font-medium">Time</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                  <th className="px-4 py-2 font-medium">Organization</th>
                  <th className="px-4 py-2 font-medium">Action</th>
                  <th className="px-4 py-2 font-medium">Target</th>
                </tr>
              </thead>
              <tbody>
                {(logs ?? []).map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="text-muted-foreground px-4 py-2 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">
                      {log.actor_id ? (actorEmailById.get(log.actor_id) ?? log.actor_id) : "system"}
                    </td>
                    <td className="text-muted-foreground px-4 py-2">
                      {log.org_id ? (orgNameById.get(log.org_id) ?? log.org_id) : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <code className="bg-secondary rounded px-1.5 py-0.5 text-xs">
                        {log.action}
                      </code>
                    </td>
                    <td className="text-muted-foreground px-4 py-2">
                      {log.target_type ? `${log.target_type}:${log.target_id}` : "—"}
                    </td>
                  </tr>
                ))}
                {(logs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground px-4 py-6 text-center">
                      No audit log entries.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          Page {page} of {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <div className="flex gap-2">
          {hasPrev && (
            <Link
              href={`/admin/audit-log?page=${page - 1}`}
              className="text-primary underline underline-offset-4"
            >
              Previous
            </Link>
          )}
          {hasNext && (
            <Link
              href={`/admin/audit-log?page=${page + 1}`}
              className="text-primary underline underline-offset-4"
            >
              Next
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
