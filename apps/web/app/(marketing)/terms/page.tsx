import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Glintpage",
};

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-24 sm:py-32">
      <article className="prose prose-neutral dark:prose-invert prose-headings:font-heading max-w-none">
        <h1>Terms of Service</h1>
        <p>
          <strong>Effective Date:</strong> June 2, 2026
        </p>

        <p>
          Welcome to Glintpage. By accessing or using our platform, you agree to
          be bound by these Terms of Service. Please read them carefully.
        </p>

        <h2>1. Description of Service</h2>
        <p>
          Glintpage provides a digital reading platform featuring customizable
          interfaces, cloud syncing, and AI-powered tools including translation,
          summarization, and audio playback. We offer access through Free, Plus,
          and Pro subscription tiers.
        </p>

        <h2>2. User Accounts & Security</h2>
        <p>
          You are responsible for maintaining the confidentiality of your
          account credentials. You agree to notify us immediately of any
          unauthorized use of your account. Glintpage is not liable for any loss
          or damage arising from your failure to protect your login information.
        </p>

        <h2>3. Intellectual Property and Copyright</h2>
        <ul>
          <li>
            <strong>Public Library:</strong> Content provided in the Glintpage
            public library is curated from public domain sources or provided
            with appropriate licensing.
          </li>
          <li>
            <strong>User Uploads (Private Vault):</strong> You retain all rights
            to the documents you upload. By uploading a document, you represent
            and warrant that you possess the necessary legal rights or licenses
            to do so. Glintpage assumes no liability for copyright infringement
            resulting from user-uploaded materials.
          </li>
          <li>
            <strong>Service Abuse:</strong> You may not use Glintpage to
            distribute, share, or pirate copyrighted material. Accounts found
            violating intellectual property laws will be terminated.
          </li>
        </ul>

        <h2>4. Subscription and Billing</h2>
        <p>
          Glintpage operates on a tiered subscription model (Free, Plus, Pro).
          Subscriptions are billed on a recurring monthly basis. You may cancel
          your subscription at any time; however, there are no refunds for
          partially used billing periods. Upon cancellation, you will retain
          access to your premium features until the end of your current billing
          cycle.
        </p>

        <h2>5. Artificial Intelligence Limitations</h2>
        <p>
          While our translation and summarization engines are designed for
          publication-grade fidelity, AI outputs are generated
          probabilistically. Glintpage does not guarantee absolute accuracy or
          flawless contextual rendering. AI features are provided "as is" and
          should be used at your own discretion.
        </p>

        <h2>6. Acceptable Use Policy</h2>
        <p>
          You agree not to misuse the Glintpage platform. This includes, but is
          not limited to: reverse-engineering our software, systematically
          scraping our public library, exploiting AI endpoints to bypass usage
          limits, or attempting to breach our server security.
        </p>

        <h2>7. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, Glintpage shall not be liable
          for any indirect, incidental, special, or consequential damages,
          including loss of data or reading progress, arising from your use of
          the platform.
        </p>

        <h2>8. Governing Law</h2>
        <p>
          These Terms shall be governed by and construed in accordance with the
          laws of Bangladesh, without regard to its conflict of law provisions.
        </p>

        <h2>9. Changes to Terms</h2>
        <p>
          We reserve the right to modify these Terms at any time. Continued use
          of the platform after any such changes constitutes your consent to the
          updated Terms.
        </p>
      </article>
    </main>
  );
}
