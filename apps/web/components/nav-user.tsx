"use client";

import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAccount } from "@/components/account-provider";
import {
  BadgeCheckIcon,
  BellIcon,
  ChevronsUpDownIcon,
  CreditCardIcon,
  LogOutIcon,
  Monitor,
  Moon,
  SparklesIcon,
  Sun,
  UserIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

export function NavUser() {
  const { setTheme } = useTheme();
  const { isMobile } = useSidebar();
  const { user, loading, signOut } = useAccount();
  const fallback = user?.name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const displayName = user?.name ?? "Reader Account";
  const displayEmail = user?.email ?? (loading ? "Loading account..." : "");
  const avatar = user?.avatarUrl ?? "";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage
                  src={avatar}
                  alt={displayName}
                  crossOrigin="anonymous"
                />
                <AvatarFallback className="rounded-lg">
                  {fallback || <UserIcon className="size-4" />}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{displayName}</span>
                <span className="truncate text-xs">{displayEmail}</span>
              </div>
              <ChevronsUpDownIcon className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage
                    src={avatar}
                    alt={displayName}
                    crossOrigin="anonymous"
                  />
                  <AvatarFallback className="rounded-lg">
                    {fallback || <UserIcon className="size-4" />}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{displayName}</span>
                  <span className="truncate text-xs">{displayEmail}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/billing">
                  <SparklesIcon />
                  Upgrade to Pro
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <BadgeCheckIcon />
                  Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/billing">
                  <CreditCardIcon />
                  Billing
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />

              <DropdownMenuLabel className="px-3 py-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                Theme
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={() => setTheme("light")}
                className="cursor-pointer gap-2 rounded-lg"
              >
                <Sun className="h-4 w-4" />
                <span>Light</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme("dark")}
                className="cursor-pointer gap-2 rounded-lg"
              >
                <Moon className="h-4 w-4" />
                <span>Dark</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme("system")}
                className="cursor-pointer gap-2 rounded-lg"
              >
                <Monitor className="h-4 w-4" />
                <span>System</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
