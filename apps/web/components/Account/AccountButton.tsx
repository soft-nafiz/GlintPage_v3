"use client";

import Link from "next/link";
import { CreditCard, LogOut, Monitor, Moon, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useAccount } from "@/components/account-provider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const AccountButton = () => {
  const { setTheme } = useTheme();
  const { user, loading, signOut } = useAccount();

  // Prevent UI flickering while fetching authentication state
  if (loading) {
    return <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />;
  }

  return (
    <>
      {user ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="outline-none group cursor-pointer">
            <Avatar className=" transition-transform group-hover:scale-105">
              {/* If user logged in via Google/GitHub, avatar_url populates automatically */}
              <AvatarImage
                src={user.avatarUrl}
                alt="Profile"
                crossOrigin="anonymous"
              />

              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 rounded-xl mt-2 p-1">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1 p-1">
                <p className="text-sm font-medium leading-none truncate">
                  {user.name}
                </p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <Link href="/dashboard">
              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg">
                <User className="h-4 w-4" />
                <span>Dashoard</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/profile">
              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/billing">
              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg">
                <CreditCard className="h-4 w-4" />
                <span>Billing</span>
              </DropdownMenuItem>
            </Link>

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

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={signOut}
              className="cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/10 rounded-lg"
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <Link href="/auth/login?view=sign-up">
          <Button size="sm" className="px-6">
            Start Reading Free
          </Button>
        </Link>
      )}
    </>
  );
};

export default AccountButton;
