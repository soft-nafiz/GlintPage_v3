import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "@/components/Account/profile-client";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Account settings",
  description:
    "Manage your Glintpage profile, subscription, avatar, and daily AI usage.",
  path: "/profile",
  noIndex: true,
});

export default async function ProfilePage() {
  const supabase = await createClient();

  // 1. Get authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // 2. Fetch the custom profile and subscription data (from your schema image)
  const { data: profile } = await supabase
    .from("profiles") // Replace with your exact table name if different (e.g., 'profiles')
    .select("*")
    .eq("id", user.id)
    .single();

  // 3. Fetch today's AI usage
  const today = new Date().toISOString().split("T")[0];

  const { data: dailyUsage } = await supabase
    .from("user_daily_usage")
    .select("translated_pages, summarized_pages")
    .eq("user_id", user.id)
    .eq("usage_date", today)
    .maybeSingle();

  return (
    <div className="max-w-4xl mx-auto py-8 px-2 sm:px-6 lg:px-8 animate-in fade-in duration-500 mt-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight font-heading text-primary">
          Account Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your personal information, subscription tier, and daily usage
          limits.
        </p>
      </div>

      {/* Pass the server-fetched data down to the interactive client component */}
      <ProfileClient
        user={user}
        profile={profile || {}}
        dailyUsage={dailyUsage || { translated_pages: 0, summarized_pages: 0 }}
      />
    </div>
  );
}
