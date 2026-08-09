import type { Metadata } from "next";

import { requirePlatformAdmin } from "@/lib/supabase/session";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { NewTemplateForm } from "./new-template-form";

export const metadata: Metadata = { title: "New workflow template" };

export default async function NewTemplatePage() {
  await requirePlatformAdmin();

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>New workflow template</CardTitle>
      </CardHeader>
      <CardContent>
        <NewTemplateForm />
      </CardContent>
    </Card>
  );
}
