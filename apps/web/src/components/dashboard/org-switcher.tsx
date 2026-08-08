"use client";

import Link from "next/link";
import { ChevronsUpDownIcon, PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type OrgSummary = { id: string; name: string; slug: string };

export function OrgSwitcher({
  organizations,
  currentSlug,
}: {
  organizations: OrgSummary[];
  currentSlug: string;
}) {
  const current = organizations.find((org) => org.slug === currentSlug);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto justify-start gap-2 px-2 py-1.5 font-semibold"
        >
          <span className="truncate">{current?.name ?? currentSlug}</span>
          <ChevronsUpDownIcon className="text-muted-foreground size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} asChild>
            <Link href={`/dashboard/${org.slug}/projects`}>{org.name}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="flex items-center gap-2">
            <PlusIcon className="size-4" />
            New organization
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
