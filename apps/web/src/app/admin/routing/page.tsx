import type { Metadata } from "next";
import Link from "next/link";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "AI Router" };

const CATEGORY_LABEL: Record<string, string> = {
  video: "Video",
  image: "Image",
  audio: "Audio",
  voice: "Voice",
  lip_sync: "Lip Sync",
  llm: "LLM",
};

export default async function AdminRoutingPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: rules } = await supabase
    .from("routing_rules")
    .select("*")
    .order("task_type");

  // Live preview per rule: actually calls select_model_for_task(), the
  // same function real generation requests will call once a Studio module
  // dispatches through it (Module 8+) — not a static readout of the
  // preferred_model_slugs column.
  const previews = await Promise.all(
    (rules ?? []).map(async (rule) => {
      const { data } = await supabase.rpc("select_model_for_task", {
        p_task_type: rule.task_type,
      });
      return { taskType: rule.task_type, selected: data?.id ? data : null };
    }),
  );
  const previewByTaskType = new Map(previews.map((p) => [p.taskType, p.selected]));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Router</h1>
        <p className="text-muted-foreground text-sm">
          Task type → model preference chains. &quot;Currently selects&quot;
          calls the same <code>select_model_for_task()</code> function real
          generation requests use — with nothing installed on a real GPU
          node yet (see{" "}
          <Link href="/admin/models" className="underline underline-offset-4">
            Model Manager
          </Link>
          ), most will show no eligible model.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {(rules ?? []).map((rule) => {
          const selected = previewByTaskType.get(rule.task_type);
          return (
            <Card key={rule.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {rule.task_type.replace(/_/g, " ")}
                  <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-xs font-normal">
                    {CATEGORY_LABEL[rule.category] ?? rule.category}
                  </span>
                </CardTitle>
                <CardDescription>{rule.description}</CardDescription>
                <div className="mt-2 flex flex-wrap items-center gap-1 text-sm">
                  <span className="text-muted-foreground">Chain:</span>
                  {rule.preferred_model_slugs.map((slug, i) => (
                    <span key={slug} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground">→</span>}
                      <code className="bg-secondary rounded px-1.5 py-0.5 text-xs">
                        {slug}
                      </code>
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-sm">
                  <span className="text-muted-foreground">Currently selects: </span>
                  {selected ? (
                    <span className="font-medium">{selected.name}</span>
                  ) : (
                    <span className="text-muted-foreground italic">
                      no eligible model installed
                    </span>
                  )}
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
