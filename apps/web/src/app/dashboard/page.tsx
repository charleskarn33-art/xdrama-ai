import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/supabase/session";
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
  const { supabase, user } = await requireUser();

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase
      .from("organization_members")
      .select("role, organizations(id, name, slug)")
      .eq("user_id", user.id),
  ]);

  const organizations = (memberships ?? [])
    .map((membership) => membership.organizations)
    .filter((org) => org !== null);

  // A single org is the common case (just signed up, created their first
  // org) — skip straight to it instead of making them pick.
  const [onlyOrg] = organizations;
  if (organizations.length === 1 && onlyOrg) {
    redirect(`/dashboard/${onlyOrg.slug}/projects`);
  }

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
          {organizations.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {organizations.map((org) => (
                <li key={org.id}>
                  <Link
                    href={`/dashboard/${org.slug}/projects`}
                    className="bg-secondary hover:bg-secondary/70 flex items-center justify-between rounded-md px-4 py-3 transition-colors"
                  >
                    <span className="font-medium">{org.name}</span>
                  </Link>
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
