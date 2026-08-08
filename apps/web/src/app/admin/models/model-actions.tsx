"use client";

import * as React from "react";

import {
  healthCheckModel,
  installModel,
  toggleModelEnabled,
  uninstallModel,
} from "@/app/admin/models/actions";
import { Button } from "@/components/ui/button";

export function ModelActions({
  modelId,
  installStatus,
  isEnabled,
}: {
  modelId: string;
  installStatus: string;
  isEnabled: boolean;
}) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function run(action: string, fn: () => Promise<{ error: string | null }>) {
    setPending(action);
    setError(null);
    const result = await fn();
    if (result.error) {
      setError(result.error);
    }
    setPending(null);
  }

  const isInstalled = installStatus === "installed";

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {isInstalled ? (
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => run("uninstall", () => uninstallModel(modelId))}
          >
            {pending === "uninstall" ? "Uninstalling..." : "Uninstall"}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            onClick={() => run("install", () => installModel(modelId))}
          >
            {pending === "install" ? "Installing..." : "Install"}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => run("health-check", () => healthCheckModel(modelId))}
        >
          {pending === "health-check" ? "Checking..." : "Health check"}
        </Button>

        <Button
          size="sm"
          variant={isEnabled ? "secondary" : "default"}
          disabled={pending !== null}
          onClick={() =>
            run("toggle", () => toggleModelEnabled(modelId, !isEnabled))
          }
        >
          {pending === "toggle" ? "..." : isEnabled ? "Disable" : "Enable"}
        </Button>
      </div>
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
