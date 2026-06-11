import { AuthenticatedAppShell } from "@/components/authenticated-app-shell";
import { AccountProvider } from "@/components/account-provider";
import { toAccountSnapshot } from "@/lib/auth/account";
import { getCurrentProfile, requireCurrentUser } from "@/lib/auth/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireCurrentUser();
  const profile = await getCurrentProfile();

  return (
    <AccountProvider initialAccount={toAccountSnapshot(user, profile)}>
      <AuthenticatedAppShell>{children}</AuthenticatedAppShell>
    </AccountProvider>
  );
}
