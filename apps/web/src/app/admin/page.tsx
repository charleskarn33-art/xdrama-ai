import type { Metadata } from "next";
import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import { getOrchestratorHealth } from "@/lib/admin/orchestrator-health";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin Overview" };

function tally<T extends string>(rows: { status: T }[] | null): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows ?? []) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return counts;
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function StatusBreakdown({
  title,
  counts,
}: {
  title: string;
  counts: Record<string, number>;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const entries = Object.entries(counts).sort(([, a], [, b]) => b - a);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <span className="text-muted-foreground text-sm font-normal">{total} total</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="text-muted-foreground text-sm">None yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {entries.map(([status, count]) => (
              <span
                key={status}
                className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-xs font-medium"
              >
                {status.replace(/_/g, " ")}: {count}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const { supabase } = await requirePlatformAdmin();

  const [
    { count: orgCount },
    { count: userCount },
    { count: projectCount },
    { count: templateCount },
    { count: routingRuleCount },
    { data: models },
    { data: renderJobs },
    { data: exportJobs },
    { data: suggestions },
    health,
  ] = await Promise.all([
    supabase.from("organizations").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("projects").select("*", { count: "exact", head: true }),
    supabase.from("workflow_templates").select("*", { count: "exact", head: true }),
    supabase.from("routing_rules").select("*", { count: "exact", head: true }),
    supabase.from("ai_models").select("install_status, is_enabled"),
    supabase.from("render_jobs").select("status"),
    supabase.from("export_jobs").select("status"),
    supabase.from("ai_suggestions").select("status"),
    getOrchestratorHealth(),
  ]);

  const installedModels = (models ?? []).filter((m) => m.install_status === "installed").length;
  const enabledModels = (models ?? []).filter((m) => m.is_enabled).length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground text-sm">
          Cross-tenant visibility for platform operators — every number here
          is a real query against this deployment&apos;s data (via the
          platform-admin SELECT policies added in Module 16), not a mock.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Organizations" value={orgCount ?? 0} />
        <StatCard label="Users" value={userCount ?? 0} />
        <StatCard label="Projects" value={projectCount ?? 0} />
        <StatCard label="Workflow templates" value={templateCount ?? 0} />
        <StatCard label="Routing rules" value={routingRuleCount ?? 0} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <Link href="/admin/models" className="hover:underline underline-offset-4">
                AI Model Manager
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6 text-sm">
            <div>
              <div className="text-2xl font-semibold">{models?.length ?? 0}</div>
              <div className="text-muted-foreground">registered</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{installedModels}</div>
              <div className="text-muted-foreground">installed</div>
            </div>
            <div>
              <div className="text-2xl font-semibold">{enabledModels}</div>
              <div className="text-muted-foreground">enabled</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI Orchestrator</CardTitle>
          </CardHeader>
          <CardContent>
            {health.reachable ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="font-medium">{health.service}</span>
                <span className="text-muted-foreground">— {health.status}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="h-2 w-2 rounded-full bg-destructive" />
                <span className="font-medium">Unreachable</span>
                <span className="text-muted-foreground">— {health.error}</span>
              </div>
            )}
            <p className="text-muted-foreground mt-2 text-xs">
              Live <code>GET /health</code> check against{" "}
              <code>AI_ORCHESTRATOR_URL</code>, run fresh on every load of this
              page.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatusBreakdown title="Render jobs" counts={tally(renderJobs)} />
        <StatusBreakdown title="Export jobs" counts={tally(exportJobs)} />
        <StatusBreakdown title="AI suggestions" counts={tally(suggestions)} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin/organizations"
          className="text-primary text-sm underline underline-offset-4"
        >
          Browse organizations
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/admin/audit-log" className="text-primary text-sm underline underline-offset-4">
          Browse audit log
        </Link>
      </div>
    </div>
  );
}
