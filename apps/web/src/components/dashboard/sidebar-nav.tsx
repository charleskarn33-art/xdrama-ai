"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClapperboardIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * The shell every future creative studio plugs into: add an entry here
 * (and to the route tree) and it shows up in every organization's nav.
 * Only "Projects" is real today — Module 3 doesn't pre-build placeholder
 * links for studios that don't exist yet.
 */
export function buildNavItems(orgSlug: string): NavItem[] {
  return [
    {
      label: "Projects",
      href: `/dashboard/${orgSlug}/projects`,
      icon: ClapperboardIcon,
    },
  ];
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
