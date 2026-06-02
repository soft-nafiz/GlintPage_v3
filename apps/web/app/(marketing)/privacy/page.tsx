import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Glintpage",
};

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
      <article className="prose prose-neutral dark:prose-invert prose-headings:font-heading max-w-none">
        <h1>Privacy Policy</h1>
        <p>
          <strong>Effective Date:</strong> June 2, 2026
        </p>

        <p>
          At Glintpage, we are committed to protecting your privacy and ensuring
          the security of your personal reading environment. This Privacy Policy
          explains how we collect, use, and safeguard your information.
        </p>

        <h2>1. Information We Collect</h2>
        <ul>
          <li>
            <strong>Account Information:</strong> When you register for a Free,
            Plus, or Pro account, we collect your email address, name, and
            authentication credentials.
          </li>
          <li>
            <strong>Private Vault Data:</strong> Books, documents (EPUBs, PDFs),
            and notes you upload to your private library.
          </li>
          <li>
            <strong>Usage Data:</strong> We collect anonymized telemetry
            regarding reading progress, UI preferences, and feature usage (e.g.,
            translation requests, audio playback) to sync your experience across
            devices.
          </li>
          <li>
            <strong>Payment Information:</strong> For Plus and Pro subscribers,
            payment details are processed securely by our third-party payment
            providers. We do not store your full credit card information on our
            servers.
          </li>
        </ul>

        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>
            To provide and maintain the Glintpage cross-device sync
            functionality.
          </li>
          <li>
            To process AI translations, summarizations, and audio generation
            requested by you.
          </li>
          <li>
            To manage your subscription, billing, and provide customer support.
          </li>
        </ul>

        <h2>3. Artificial Intelligence and Your Data</h2>
        <p>
          Glintpage utilizes advanced AI models to provide translation,
          summarization, and audio features.{" "}
          <strong>
            We do not use your private uploads, personal reading data, or
            generated translations to train our base AI models.
          </strong>{" "}
          Data sent to our AI endpoints is strictly used to process your
          immediate request and is not permanently stored by third-party LLM
          providers.
        </p>

        <h2>4. Data Security & Private Uploads</h2>
        <p>
          Your Private Vault is exactly that—private. Documents uploaded by
          users are encrypted and logically isolated. They are not visible to
          the public library, other users, or indexable by search engines.
        </p>

        <h2>5. Third-Party Services</h2>
        <p>
          We may share strictly necessary data with trusted third-party vendors
          to facilitate our services (e.g., cloud hosting, payment gateways, and
          AI API providers). These vendors are bound by strict data processing
          agreements and cannot use your data for their own purposes.
        </p>

        <h2>6. Your Data Rights</h2>
        <p>
          You have the right to access, modify, or permanently delete your
          account and all associated data at any time through your account
          settings. Upon deletion, all private vault documents and reading
          history are purged from our active servers.
        </p>

        <h2>7. Contact Us</h2>
        <p>
          If you have questions about this policy, please contact us via the
          support form on our Contact page.
        </p>
      </article>
    </main>
  );
}
