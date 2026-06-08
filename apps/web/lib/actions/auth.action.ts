"use server";

import { createClient } from "../supabase/server";
import { redirect } from "next/navigation";

export async function signInWithGoogle() {
  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/callback`,
    },
  });
  if (error) {
    console.error("[auth] Google sign-in failed:", error.message);
    redirect("/auth/login?error=oauth");
  }
  if (data.url) {
    redirect(data.url);
  }
}
