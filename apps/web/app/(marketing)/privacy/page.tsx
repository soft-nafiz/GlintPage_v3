import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Glintpage",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
      <article className="prose prose-neutral dark:prose-invert prose-headings:font-heading max-w-none">
        <h1>Privacy Policy</h1>
        <p>Last updated: June 2026</p>

        <h2>1. Information We Collect</h2>
        <p>
          When you register for Glintpage, we collect your email address and
          authentication data. Any personal documents (EPUBs, PDFs) uploaded to
          your Private Vault are strictly encrypted and remain yours. We do not
          use your private library data to train public models.
        </p>

        <h2>2. How We Use Your Information</h2>
        <p>
          Your information is used solely to provide and improve the Glintpage
          service, process transactions for Pro/Plus tiers, and maintain the
          security of your account.
        </p>

        {/* Add full policy details here */}
      </article>
    </main>
  );
}
