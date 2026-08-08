import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import { signOut } from "@/app/(auth)/actions";
import { CreateOrganizationForm } from "./create-organization-form";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase
      .from("organization_members")
      .select("role, organizations(id, name, slug)")
      .eq("user_id", user.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {profile?.full_name ? `Welcome, ${profile.full_name}` : "Welcome"}
          </h1>
          <p className="text-muted-foreground text-sm">{profile?.email}</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            Sign out
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your organizations</CardTitle>
          <CardDescription>
            Every project, script, and render belongs to an organization.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {memberships && memberships.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {memberships.map((membership) => (
                <li
                  key={membership.organizations?.id}
                  className="bg-secondary flex items-center justify-between rounded-md px-4 py-3"
                >
                  <span className="font-medium">{membership.organizations?.name}</span>
                  <span className="text-muted-foreground text-xs uppercase tracking-wide">
                    {membership.role}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">
              You&apos;re not part of an organization yet — create one to get started.
            </p>
          )}

          <Separator />

          <CreateOrganizationForm />
        </CardContent>
      </Card>
    </main>
  );
}
