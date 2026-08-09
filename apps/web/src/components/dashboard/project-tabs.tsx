"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function ProjectTabs({ basePath }: { basePath: string }) {
  const pathname = usePathname();
  const tabs = [
    { label: "Settings", href: basePath },
    { label: "Scripts", href: `${basePath}/scripts` },
    { label: "Characters", href: `${basePath}/characters` },
    { label: "Locations", href: `${basePath}/locations` },
    { label: "Props", href: `${basePath}/props` },
    { label: "Scenes", href: `${basePath}/scenes` },
    { label: "Timeline", href: `${basePath}/timeline` },
    { label: "Movie Composer", href: `${basePath}/movies` },
    { label: "Voice Studio", href: `${basePath}/voice` },
    { label: "Music Studio", href: `${basePath}/music` },
    { label: "Notes", href: `${basePath}/notes` },
    { label: "Workflows", href: `${basePath}/workflows` },
    { label: "AI Advisor", href: `${basePath}/advisor` },
  ];

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((tab) => {
        const isActive =
          tab.href === basePath
            ? pathname === basePath
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
