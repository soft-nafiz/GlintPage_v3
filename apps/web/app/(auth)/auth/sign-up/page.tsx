import { SignUpForm } from "@/components/auth/SignUpForm";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Create an account",
  description:
    "Create a Glintpage account to upload books, translate pages, summarize chapters, and build a multilingual reading library.",
  path: "/auth/sign-up",
  noIndex: true,
});

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <SignUpForm />
      </div>
    </div>
  );
}
