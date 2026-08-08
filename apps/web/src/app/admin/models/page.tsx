import type { Metadata } from "next";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { ModelActions } from "./model-actions";

export const metadata: Metadata = { title: "AI Model Manager" };

const CATEGORY_LABEL: Record<string, string> = {
  video: "Video",
  image: "Image",
  audio: "Audio",
  voice: "Voice",
  lip_sync: "Lip Sync",
  llm: "LLM",
};

const INSTALL_STATUS_STYLE: Record<string, string> = {
  not_installed: "bg-secondary text-secondary-foreground",
  downloading: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  installed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-destructive/10 text-destructive",
};

const HEALTH_STATUS_STYLE: Record<string, string> = {
  unknown: "bg-secondary text-secondary-foreground",
  healthy: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  unhealthy: "bg-destructive/10 text-destructive",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

export default async function AdminModelsPage() {
  const { supabase } = await requirePlatformAdmin();

  const { data: models } = await supabase
    .from("ai_models")
    .select("*")
    .order("category")
    .order("name");

  const categories = Array.from(
    new Set((models ?? []).map((m) => m.category)),
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI Model Manager</h1>
        <p className="text-muted-foreground text-sm">
          The platform-wide model registry. Install/uninstall/health-check
          dispatch to GPU render nodes via the AI orchestrator — with no
          render nodes attached yet, those actions report that honestly
          rather than pretending to succeed.
        </p>
      </div>

      {categories.map((category) => (
        <div key={category} className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">{CATEGORY_LABEL[category] ?? category}</h2>
          <div className="flex flex-col gap-3">
            {(models ?? [])
              .filter((m) => m.category === category)
              .map((model) => (
                <Card key={model.id}>
                  <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {model.name}
                        <span className="text-muted-foreground text-xs font-normal">
                          {model.version}
                        </span>
                      </CardTitle>
                      <CardDescription>
                        {model.description || "No description"}
                      </CardDescription>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                          label={model.install_status.replace("_", " ")}
                          className={INSTALL_STATUS_STYLE[model.install_status] ?? ""}
                        />
                        <Badge
                          label={`health: ${model.health_status}`}
                          className={HEALTH_STATUS_STYLE[model.health_status] ?? ""}
                        />
                        <Badge
                          label={model.is_enabled ? "enabled" : "disabled"}
                          className={
                            model.is_enabled
                              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
                              : "bg-secondary text-secondary-foreground"
                          }
                        />
                        {model.vram_gb && (
                          <span className="text-muted-foreground text-xs">
                            {model.vram_gb} GB VRAM
                          </span>
                        )}
                        {model.supported_features.map((feature) => (
                          <span
                            key={feature}
                            className="text-muted-foreground text-xs italic"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                    <ModelActions
                      modelId={model.id}
                      installStatus={model.install_status}
                      isEnabled={model.is_enabled}
                    />
                  </CardHeader>
                </Card>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
