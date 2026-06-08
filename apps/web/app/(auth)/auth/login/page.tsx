import { createMetadata } from "@/lib/seo";
import { LoginClient } from "./login-client";

export const metadata = createMetadata({
  title: "Log in",
  description: "Log in to Glintpage to access your AI-powered reading library.",
  path: "/auth/login",
  noIndex: true,
});

export default function LoginPage() {
  return <LoginClient />;
}
