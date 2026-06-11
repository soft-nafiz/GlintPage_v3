import type { User } from "@supabase/supabase-js";
import type { CurrentProfile } from "@/lib/auth/types";

export type AccountUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
};

export type AccountSnapshot = {
  user: AccountUser | null;
  profile: CurrentProfile | null;
};

export function normalizeAccountUser(
  user: User,
  profile?: CurrentProfile | null,
): AccountUser {
  const name =
    profile?.full_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "Reader Account";

  return {
    id: user.id,
    email: user.email ?? profile?.email ?? "",
    name,
    avatarUrl: profile?.avatar_url || user.user_metadata?.avatar_url || "",
  };
}

export function toAccountSnapshot(
  user: User | null,
  profile: CurrentProfile | null = null,
): AccountSnapshot {
  return {
    user: user ? normalizeAccountUser(user, profile) : null,
    profile,
  };
}
