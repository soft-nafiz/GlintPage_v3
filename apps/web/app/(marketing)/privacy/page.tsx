import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Privacy Policy",
  description:
    "Read the Glintpage Privacy Policy for details about account data, private book uploads, AI usage, payments, and reader privacy.",
  path: "/privacy",
  keywords: ["Glintpage privacy policy", "reader privacy", "AI app privacy"],
});

export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-16 px-4 sm:px-6 lg:px-8 mt-10">
      <div className="max-w-3xl mx-auto">
        {/* Back Navigation */}
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 mb-8 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Link>

        {/* Header Section */}
        <div className="mb-10 border-b border-zinc-200 dark:border-zinc-800 pb-8">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Effective Date: June 2, 2026
          </p>
        </div>

        {/* Content Section */}
        <div className="space-y-8 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p>
            At Glintpage, we are committed to protecting your privacy and
            ensuring the security of your personal reading environment. This
            Privacy Policy explains how we collect, use, and safeguard your
            information.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              1. Information We Collect
            </h2>
            <ul className="list-disc pl-6 space-y-2 marker:text-zinc-400">
              <li>
                <strong>Account Information:</strong> When you register for a
                Free, Plus, or Pro account, we collect your email address, name,
                and authentication credentials.
              </li>
              <li>
                <strong>Private Vault Data:</strong> Books, documents (EPUBs,
                PDFs), and notes you upload to your private library.
              </li>
              <li>
                <strong>Usage Data:</strong> We collect anonymized telemetry
                regarding reading progress, UI preferences, and feature usage
                (e.g., translation requests, audio playback) to sync your
                experience across devices.
              </li>
              <li>
                <strong>Payment Information:</strong> For Plus and Pro
                subscribers, payment details are processed securely by our
                third-party payment providers. We do not store your full credit
                card information on our servers.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              2. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-2 marker:text-zinc-400">
              <li>
                To provide and maintain the Glintpage cross-device sync
                functionality.
              </li>
              <li>
                To process AI translations, summarizations, and audio generation
                requested by you.
              </li>
              <li>
                To manage your subscription, billing, and provide customer
                support.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              3. Artificial Intelligence and Your Data
            </h2>
            <p>
              Glintpage utilizes advanced AI models to provide translation,
              summarization, and audio features.{" "}
              <strong className="text-zinc-900 dark:text-zinc-100">
                We do not use your private uploads, personal reading data, or
                generated translations to train our base AI models.
              </strong>{" "}
              Data sent to our AI endpoints is strictly used to process your
              immediate request and is not permanently stored by third-party LLM
              providers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              4. Data Security & Private Uploads
            </h2>
            <p>
              Your Private Vault is exactly that—private. Documents uploaded by
              users are encrypted and logically isolated. They are not visible
              to the public library, other users, or indexable by search
              engines.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              5. Third-Party Services
            </h2>
            <p>
              We may share strictly necessary data with trusted third-party
              vendors to facilitate our services (e.g., cloud hosting, payment
              gateways, and AI API providers). These vendors are bound by strict
              data processing agreements and cannot use your data for their own
              purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              6. Your Data Rights
            </h2>
            <p>
              You have the right to access, modify, or permanently delete your
              account and all associated data at any time through your account
              settings. Upon deletion, all private vault documents and reading
              history are purged from our active servers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              7. Contact Us
            </h2>
            <p>
              If you have questions about this policy, please contact us via the
              support form on our Contact page.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
