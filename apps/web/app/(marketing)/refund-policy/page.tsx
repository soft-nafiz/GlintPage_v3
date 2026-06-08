import Link from "next/link";
import { ArrowLeft } from "lucide-react"; // Make sure lucide-react is installed, or remove this icon
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Refund and Cancellation Policy",
  description:
    "Review Glintpage refund and cancellation terms for AI reading, translation, summary, audio, and subscription usage.",
  path: "/refund-policy",
  keywords: ["Glintpage refund policy", "AI app cancellation policy"],
});

export default function RefundPolicy() {
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
            Refund and Cancellation Policy
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Effective Date: June 5, 2026
          </p>
        </div>

        {/* Content Section */}
        <div className="space-y-8 text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          <p>
            Thank you for subscribing to Glintpage. We strive to provide a
            seamless, premium reading and translation experience. Because our
            platform relies on real-time artificial intelligence processing that
            incurs immediate, non-recoverable computing costs, our refund policy
            is strictly structured to protect our platform while remaining fair
            to our users.
          </p>
          <p>
            Please read this policy carefully before purchasing a premium
            subscription.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              1. Subscription Cancellations
            </h2>
            <p className="mb-3">
              You can cancel your Glintpage subscription at any time.
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-zinc-400">
              <li>
                <strong>How to cancel:</strong> You can manage or cancel your
                subscription directly from your Account Billing portal.
              </li>
              <li>
                <strong>Access after cancellation:</strong> If you cancel, you
                will not be billed for the following billing cycle. You will
                continue to have full access to your premium tier features until
                the end of your current active billing period.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              2. General Refund Policy
            </h2>
            <p>
              Due to the digital nature of our service and the immediate API
              costs associated with AI text translation and summarization,{" "}
              <strong>
                we do not offer automatic or prorated refunds for any unused
                time on your subscription.
              </strong>{" "}
              Once a billing cycle has started and your account has actively
              utilized premium AI processing, that payment is final and
              non-refundable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              3. Exceptional Circumstances (7-Day Review)
            </h2>
            <p className="mb-3">
              We want you to be happy with Glintpage. We may, at our sole
              discretion, grant a refund within{" "}
              <strong>7 days of your initial purchase</strong> if you meet the
              following conditions:
            </p>
            <ul className="list-disc pl-6 space-y-2 marker:text-zinc-400">
              <li>
                You have not utilized a significant portion of your premium
                translation/summarization limits.
              </li>
              <li>
                You encountered a critical, documented technical bug that
                prevented you from using the core reading interface, and our
                support team was unable to resolve it.
              </li>
            </ul>
            <p className="mt-4 text-sm text-zinc-500 italic">
              *Note: Renewal charges for ongoing subscriptions are not eligible
              for the 7-day review.*
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              4. Merchant of Record Processing
            </h2>
            <p>
              Our order process is conducted by our online resellers and
              Merchants of Record (e.g., Lemon Squeezy / Paddle). They handle
              all customer service inquiries related directly to payment
              processing, card declines, and secure invoicing. All successful
              refund requests approved by Glintpage will be processed back to
              the original payment method through their secure gateways. Please
              allow 5-10 business days for the funds to appear on your bank
              statement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              5. Account Termination
            </h2>
            <p>
              If your account is terminated or suspended due to a violation of
              our Terms of Service (e.g., automated scraping, abuse of API
              limits, or sharing account credentials), you will not be eligible
              for any refund for your remaining subscription period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              6. Contact Us
            </h2>
            <p>
              If you believe you qualify for a refund under our exceptional
              circumstances, or if you need help managing your billing portal,
              please contact us at:
            </p>
            <p className="mt-2 font-medium text-zinc-900 dark:text-zinc-100">
              Email:{" "}
              <a
                href="mailto:support@glintpage.com"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                support@glintpage.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
