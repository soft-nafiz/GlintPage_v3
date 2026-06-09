"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { User, LogOut, LayoutDashboard, CreditCard } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
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

// Custom type matching Supabase's User metadata schema
interface UserData {
  email?: string;
  user_metadata?: {
    avatar_url?: string;
    full_name?: string;
  };
}

const AccountButton = () => {
  const supabase = createClient();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch current user session state
    const fetchUser = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();
      setUser(currentUser);
      setLoading(false);
    };

    fetchUser();

    // 2. Setup a live listener to handle instant UI updates on login/logout
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/"; // Force redirect clean redirect to home
  };

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
                src={user.user_metadata?.avatar_url}
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
                  {user.user_metadata?.full_name || "Reader Account"}
                </p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            <Link href="/profile">
              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg">
                <User className="h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/dashboard">
              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
            </Link>
            <Link href="/billing">
              <DropdownMenuItem className="cursor-pointer gap-2 rounded-lg">
                <CreditCard className="h-4 w-4" />
                <span>Billing</span>
              </DropdownMenuItem>
            </Link>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onClick={handleLogout}
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
