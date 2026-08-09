"use client";

import * as React from "react";

import {
  requestSuggestions,
  type Suggestion,
} from "@/app/dashboard/[orgSlug]/projects/[projectId]/advisor/actions";
import type { AdvisorRole } from "@/lib/validations/advisor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  running: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  completed:
    "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  failed: "bg-destructive/10 text-destructive",
};

export function AdvisorRoleCard({
  orgSlug,
  projectId,
  role,
  title,
  description,
  initialSuggestions,
}: {
  orgSlug: string;
  projectId: string;
  role: AdvisorRole;
  title: string;
  description: string;
  initialSuggestions: Suggestion[];
}) {
  const [suggestions, setSuggestions] = React.useState(initialSuggestions);
  const [isRequesting, setIsRequesting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleRequest() {
    setIsRequesting(true);
    setError(null);
    const result = await requestSuggestions(orgSlug, { projectId, role });
    if (result.error !== null) {
      setError(result.error);
    } else {
      setSuggestions((prev) => [result.suggestion, ...prev]);
    }
    setIsRequesting(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{title}</span>
          <Button size="sm" disabled={isRequesting} onClick={handleRequest}>
            {isRequesting ? "Requesting..." : "Request suggestions"}
          </Button>
        </CardTitle>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error && <p className="text-destructive text-xs">{error}</p>}

        {suggestions.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="bg-secondary/40 flex flex-col gap-1 rounded-md px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-mono text-xs">
                    {new Date(s.created_at).toLocaleString()}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status] ?? ""}`}
                  >
                    {s.status}
                  </span>
                </div>
                {s.error_message && (
                  <p className="text-muted-foreground text-xs">
                    {s.error_message}
                  </p>
                )}
                {s.result != null && (
                  <pre className="overflow-x-auto text-xs">
                    {JSON.stringify(s.result, null, 2)}
                  </pre>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No requests yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
