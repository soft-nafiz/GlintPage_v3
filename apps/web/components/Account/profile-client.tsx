"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  AlertTriangle,
  CreditCard,
  Loader2,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Helper to determine limits based on your schema's plan tiers
const getPlanLimits = (plan: string) => {
  switch (plan) {
    case "pro":
      return { translate: 63000, summarize: 120000 };
    case "plus":
    case "trial":
      return { translate: 27000, summarize: 40000 };
    default:
      return { translate: 2700, summarize: 4000 };
  }
};

type Profile = {
  full_name?: string | null;
  avatar_url?: string | null;
  plan?: string | null;
  subscription_status?: string | null;
  customer_portal_url?: string | null;
  current_period_end?: string | null;
};

type DailyUsage = {
  translated_tokens: number;
  summarized_tokens: number;
};

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default function ProfileClient({
  user,
  profile,
  dailyUsage,
}: {
  user: SupabaseUser;
  profile: Profile;
  dailyUsage: DailyUsage;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [fullName, setFullName] = useState(
    profile.full_name || user.user_metadata?.full_name || "",
  );

  const [avatarUrl, setAvatarUrl] = useState(
    profile.avatar_url || user.user_metadata?.avatar_url || "",
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const limits = getPlanLimits(profile.plan || "free");
  const translatePercent = Math.min(
    (dailyUsage.translated_tokens / limits.translate) * 100,
    100,
  );
  const summarizePercent = Math.min(
    (dailyUsage.summarized_tokens / limits.summarize) * 100,
    100,
  );

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;

      // 1. Enforce a 2MB max file size
      if (file.size > 2 * 1024 * 1024) {
        alert("File size must be less than 2MB.");
        return;
      }

      // 2. Generate a unique file name to prevent caching issues
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${Math.random().toString(36).substring(2)}.${fileExt}`;

      // 3. Upload to the 'avatars' bucket in Supabase
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 4. Get the public URL of the uploaded image
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      // 5. Update your database schema
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Also update Auth metadata so it persists globally
      await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      // 6. Update local state to show the new image instantly
      setAvatarUrl(publicUrl);
      router.refresh();
    } catch (error) {
      console.error("Error uploading avatar:", error);
      alert("Failed to upload avatar. Please try again.");
    } finally {
      setIsUploading(false);
      // Reset the input value so the user can upload the same file again if they want
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // Update custom users table
      await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", user.id);

      // Update Auth metadata
      await supabase.auth.updateUser({
        data: { full_name: fullName },
      });

      router.refresh(); // Sync server state
    } catch (error) {
      console.error("Failed to update profile", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    // Note: Secure account deletion usually requires calling a Supabase Edge Function
    // or an API route with the Supabase Admin Role to bypass standard RLS.
    try {
      await fetch("/api/auth/delete-account", { method: "POST" });
      await supabase.auth.signOut();
      router.push("/");
    } catch (error) {
      console.error("Failed to delete account", error);
      setIsDeleting(false);
    }
  };

  const manageBilling = () => {
    // If you have a Lemon Squeezy Customer Portal URL saved in the DB, redirect to it.
    if (profile.customer_portal_url) {
      window.open(profile.customer_portal_url, "_blank");
    } else {
        router.push("/pricing"); // Fallback if no active subscription
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Identity & Profile Section */}
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-xl font-bold">Public Profile</CardTitle>
          <CardDescription>
            Update your personal information and how others see you.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateProfile}>
          <CardContent className="space-y-6 mb-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20 border-2 shadow-sm">
                <AvatarImage
                  src={avatarUrl}
                  alt="Profile Picture"
                  crossOrigin="anonymous"
                />
                <AvatarFallback className="bg-primary/10 text-xl font-medium">
                  <User className="h-8 w-8 text-primary/60" />
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-2">
                {/* Hidden file input */}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleAvatarUpload}
                  disabled={isUploading}
                />

                {/* Trigger Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    "Upload Image"
                  )}
                </Button>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WEBP. Max size of 2MB.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  value={user.email}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="border-t">
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* 2. Subscription & Usage (Bento Layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lemon Squeezy Subscription Details */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <CreditCard className="h-5 w-5 text-primary" />
              Subscription Status
            </CardTitle>
            <CardDescription>
              Manage your billing and active plans.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-xl bg-card">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Current Tier
                </p>
                <p className="text-2xl font-bold capitalize text-primary font-heading">
                  {profile.plan || "Free"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <div className="flex items-center gap-1 mt-1 text-sm font-semibold text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  {profile.subscription_status || "Free"}
                </div>
              </div>
            </div>
            {profile.current_period_end && (
              <p className="text-xs text-muted-foreground">
                Your next billing cycle updates on{" "}
                {new Date(profile.current_period_end).toLocaleDateString()}.
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              onClick={manageBilling}
              variant="secondary"
              className="w-full text-gold cursor-pointer"
            >
              Manage Billing Details
            </Button>
          </CardFooter>
        </Card>

        {/* Daily Usage Stats */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-xl font-bold">Daily AI Usage</CardTitle>
            <CardDescription>
              Your translation and summary capacity for today.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Translation Tokens</span>
                <span className="text-muted-foreground">
                  {formatCompactNumber(dailyUsage.translated_tokens)} /{" "}
                  {formatCompactNumber(limits.translate)}
                </span>
              </div>
              <Progress
                value={translatePercent}
                className={`h-2 ${translatePercent > 90 ? "*:bg-destructive" : ""}`}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Summary Tokens</span>
                <span className="text-muted-foreground">
                  {formatCompactNumber(dailyUsage.summarized_tokens)} /{" "}
                  {formatCompactNumber(limits.summarize)}
                </span>
              </div>
              <Progress value={summarizePercent} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. Danger Zone */}
      <Card className="border-destructive/20 bg-destructive/5 shadow-none">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2 text-xl font-bold">
            <AlertTriangle className="h-5 w-5" /> Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete your account, active subscriptions, and all
            uploaded books. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete Account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-mono">
                  Are you absolutely sure?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  your account, wipe your library, and instantly cancel any
                  active Lemon Squeezy subscriptions.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Yes, delete my account"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </div>
  );
}
