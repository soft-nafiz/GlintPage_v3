"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  normalizeAccountUser,
  type AccountSnapshot,
} from "@/lib/auth/account";

type AccountContextValue = AccountSnapshot & {
  loading: boolean;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({
  children,
  initialAccount = { user: null, profile: null },
}: {
  children: ReactNode;
  initialAccount?: AccountSnapshot;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [account, setAccount] = useState<AccountSnapshot>(initialAccount);
  const [loading, setLoading] = useState(!initialAccount.user);

  useEffect(() => {
    let mounted = true;

    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;
      setAccount((current) => ({
        profile: user ? current.profile : null,
        user: user ? normalizeAccountUser(user, current.profile) : null,
      }));
      setLoading(false);
    };

    fetchUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount((current) => ({
        profile: session?.user ? current.profile : null,
        user: session?.user
          ? normalizeAccountUser(session.user, current.profile)
          : null,
      }));
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AccountContextValue>(
    () => ({
      ...account,
      loading,
      signOut: async () => {
        await supabase.auth.signOut();
        setAccount({ user: null, profile: null });
        window.location.href = "/";
      },
    }),
    [account, loading, supabase],
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) {
    throw new Error("useAccount must be used within AccountProvider");
  }
  return context;
}
