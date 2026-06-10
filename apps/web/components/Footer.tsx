import Link from "next/link";
import React from "react";
import { MaxWidthWrapper } from "./max-width-wrapper";

const Footer = () => {
  return (
    <footer className="bg-ink-footer p-16">
      <MaxWidthWrapper className="px-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr] gap-8 lg:gap-10 pb-12 border-b border-white/5 mb-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="text-2xl font-heading font-semibold text-accent"
            >
              Glint<span className="text-gold">page</span>
            </Link>
            <p className="text-sm font-light leading-relaxed text-muted-foreground max-w-sm">
              Read any book, in your language, instantly. AI-powered translation
              for the modern reader.
            </p>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
              Product
            </div>
            <ul className="flex flex-col gap-3 text-sm font-light text-accent mt-4 ">
              <li className="hover:text-accent/65">
                <Link href="#">Download</Link>
              </li>
              <li className="hover:text-accent/65">
                <Link href="/changelog">MVP Changelog</Link>
              </li>
              <li className="hover:text-accent/65 ">
                <Link href="#">Pricing</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
              Company
            </div>
            <ul className="flex flex-col gap-3 text-sm font-light text-accent mt-4 ">
              <li className="hover:text-accent/65 ">
                <Link href="/about">About Us</Link>
              </li>
              <li className="hover:text-accent/65 ">
                <Link href="/contact">Contact</Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
              Legal
            </div>
            <ul className="flex flex-col gap-3 text-sm font-light text-accent mt-4 ">
              <li className="hover:text-accent/65 ">
                <Link href="/privacy">Privacy Policy</Link>
              </li>
              <li className="hover:text-accent/65">
                <Link href="/terms">Terms of Service</Link>
              </li>
              <li className="hover:text-accent/65">
                <Link href="/refund-policy">Refund Policy</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-accent text-center sm:text-left">
          <span>Glintpage © 2026</span>
          <span>Made with care for readers everywhere.</span>
        </div>
      </MaxWidthWrapper>
    </footer>
  );
};

export default Footer;
