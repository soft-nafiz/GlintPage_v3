"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";

import AccountButton from "./Account/AccountButton";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "Explore Library", href: "/library" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50",
          "backdrop-blur-xl backdrop-saturate-150",
          "bg-background/72 border-b border-[var(--gold)]/15",
          "transition-all duration-300",
        )}
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href="/"
            className="font-heading text-2xl font-semibold tracking-tight shrink-0"
          >
            Glint<span className="text-primary">page</span>
          </Link>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-9">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-light text-muted-foreground hover:text-foreground transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop right */}
          <div className="flex items-center gap-2">
            <AccountButton />
            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <div
        className={cn(
          "fixed inset-x-0 top-16 z-40 md:hidden",
          "bg-background/95 backdrop-blur-xl",
          "border-b border-border",
          "transition-all duration-300 overflow-hidden",
          mobileOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="flex flex-col gap-1 px-5 py-4">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="py-3 text-base font-light text-muted-foreground hover:text-foreground transition-colors border-b border-border last:border-0"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </>
  );
}
