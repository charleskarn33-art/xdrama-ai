import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PIPELINE_STAGES = [
  "Script",
  "Storyboard",
  "Characters",
  "Locations",
  "Video",
  "Voice",
  "Music",
  "Composer",
  "Export",
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24">
      <div className="flex max-w-2xl flex-col items-center gap-4 text-center">
        <span className="text-muted-foreground text-sm font-medium tracking-wide uppercase">
          AI Operating System for Filmmakers
        </span>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          XDrama AI Studio
        </h1>
        <p className="text-muted-foreground text-balance">
          Turn a script, a prompt, or an uploaded asset into a finished movie
          — without ever touching the AI pipeline underneath.
        </p>
        <div className="mt-2 flex gap-3">
          <Button size="lg" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </div>

      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Foundation status</CardTitle>
          <CardDescription>
            Modules 1–14 are live — from the repo scaffold and auth/org
            accounts through the full creative pipeline (Story Bible, Script
            Studio, Storyboard &amp; Scene Studio, Movie Composer, Voice/
            Music/Subtitle Studios, the AI Director/Cinematographer/Producer
            advisor) to Export Studio, all built on the shared AI Model
            Manager, Router, and Workflow Engine. See the per-module docs for
            details. Creative studios ship module by module from here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="flex flex-wrap gap-2">
            {PIPELINE_STAGES.map((stage) => (
              <li
                key={stage}
                className="bg-secondary text-secondary-foreground rounded-full px-3 py-1 text-xs font-medium"
              >
                {stage}
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}
