import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Contact Glintpage",
  description:
    "Contact the Glintpage team for support, product feedback, billing questions, or help with AI-powered book translation and reading.",
  path: "/contact",
  keywords: ["Glintpage support", "AI reader support", "book translation support"],
});

export default function ContactPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-24 sm:py-32">
      <h1 className="text-4xl font-heading font-light tracking-tight mb-4 text-foreground">
        Contact Us
      </h1>
      <p className="text-muted-foreground mb-12">
        Have a question, feedback on the MVP, or need technical support? Drop us
        a line below.
      </p>

      <form className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label
              htmlFor="name"
              className="text-sm font-medium text-foreground"
            >
              Name
            </label>
            <input
              id="name"
              type="text"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="John Doe"
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="text-sm font-medium text-foreground"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              placeholder="john@example.com"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label
            htmlFor="message"
            className="text-sm font-medium text-foreground"
          >
            Message
          </label>
          <textarea
            id="message"
            rows={5}
            className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
            placeholder="How can we help?"
          />
        </div>
        <button
          type="submit"
          className="w-full sm:w-auto px-8 py-3 bg-foreground text-background rounded-xl font-medium hover:opacity-90 transition-opacity"
        >
          Send Message
        </button>
      </form>
    </main>
  );
}
