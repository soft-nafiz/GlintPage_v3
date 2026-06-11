"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bookmark, Heart, Home, Library } from "lucide-react";
import { LucideIcon } from "lucide-react";
import AccountButton from "@/components/Account/AccountButton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NavUser } from "./nav-user";

type nav = {
  label: string;
  href: string;
  icon: LucideIcon;
};

const navItems: nav[] = [
  { label: "Dashboard", href: "/dashboard", icon: Home },
  { label: "Library", href: "/dashboard/library", icon: Library },
  { label: "My books", href: "/dashboard/my-books", icon: BookOpen },
  { label: "Favorites", href: "/dashboard/favorites", icon: Heart },
  { label: "Reading list", href: "/dashboard/reading-list", icon: Bookmark },
];

function LogoLink({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      src="/glintpage-logo.png"
      alt="Glintpage logo"
      width={160}
      height={36}
      className={`${compact ? "h-7" : "h-8"} w-auto object-contain`}
      priority={compact}
    />
  );
}

export function AuthenticatedAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar variant="inset">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="rounded-md">
                <a href="#">
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <LogoLink />
                    <span className="truncate text-xs">Book For Everyone</span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem className="space-y-2">
                {navItems.map((link) => (
                  <SidebarMenuButton
                    key={link.href}
                    asChild
                    className={cn(pathname === link.href ? "bg-accent" : "")}
                  >
                    <Link href={link.href}>
                      <link.icon />
                      <span>{link.label}</span>
                    </Link>
                  </SidebarMenuButton>
                ))}
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <NavUser />
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="px-0 py-0 lg:px-8 lg:py-8">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <LogoLink compact />
          <AccountButton />
        </header>
        <SidebarTrigger className="-ml-2 -mt-2 max-md:hidden" />
        <div className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 lg:px-0 lg:py-0 lg:pb-0">
          {children}
        </div>
        <nav className="fixed inset-x-0 bottom-0 z-50 flex w-full h-16 justify-between items-center px-4 sm:px-12 border-t bg-background/95  backdrop-blur lg:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                title={item.label}
                className={cn(
                  "flex h-10 w-10 items-center justify-center text-muted-foreground",
                  active && "text-primary  ",
                )}
              >
                <Icon className="h-5.5 w-5.5" />
              </Link>
            );
          })}
        </nav>
      </SidebarInset>
    </SidebarProvider>
  );
}
