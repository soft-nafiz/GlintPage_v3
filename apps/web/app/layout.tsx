import type { Metadata } from "next";
import { Cormorant_Garamond, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "600"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Glintpage — Read Any Book, In Your Language",
  description:
    "AI-powered reader and translator that breaks down language barriers, giving you a seamless and immersive reading experience.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        "overflow-x-hidden",
        figtree.variable,
        cormorant.variable,
      )}
    >
      <body>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
