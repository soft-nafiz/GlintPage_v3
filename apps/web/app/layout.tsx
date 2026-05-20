import type { Metadata } from "next";
import {
  Geist,
  Geist_Mono,
  Montserrat,
  Raleway,
  Cormorant_Garamond,
  Figtree,
} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Navbar } from "@/components/Navbar";
import Footer from "@/components/Footer";

const ralewayHeading = Raleway({
  subsets: ["latin"],
  variable: "--font-heading",
});

const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
      <body className="min-h-full flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}

// (geistSans.variable,
//   geistMono.variable,
//   "font-sans",
//   montserrat.variable,
//   ralewayHeading.variable);
