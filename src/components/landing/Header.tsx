"use client";

import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/Logo";

const nav = [
  { href: "#pipeline", label: "Pipeline" },
  { href: "#how", label: "How it works" },
  { href: "#testimonials", label: "Testimonials" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black/90 backdrop-blur-md">
      <div className="relative mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Logo href="/" />

        <nav
          className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-8 md:flex"
          aria-label="Primary"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-zinc-400 transition hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <SignedOut>
            <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
              <button
                type="button"
                className="hidden rounded-full border border-zinc-600 px-4 py-2 text-xs font-semibold text-zinc-200 transition hover:border-zinc-400 hover:text-white sm:inline-flex"
              >
                Log in
              </button>
            </SignInButton>
            <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
              <button
                type="button"
                className="hidden rounded-full border border-white/80 px-5 py-2 text-xs font-semibold text-white transition hover:bg-white hover:text-black sm:inline-flex"
              >
                Get started
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton
              afterSignOutUrl="/"
              appearance={{
                elements: {
                  userButtonAvatarBox: "h-9 w-9 ring-2 ring-zinc-700",
                },
              }}
            />
          </SignedIn>
          <button
            type="button"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 md:hidden"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            Menu
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-zinc-800 px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-zinc-300"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <div className="flex flex-col gap-2">
              <SignedOut>
                <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
                  <span className="block rounded-full border border-zinc-600 py-2 text-center text-sm font-semibold text-zinc-200">
                    Log in
                  </span>
                </SignInButton>
                <SignUpButton mode="redirect" forceRedirectUrl="/dashboard">
                  <span className="block rounded-full border border-white/80 py-2 text-center text-sm font-semibold text-white">
                    Get started
                  </span>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <div className="flex justify-center py-2">
                  <UserButton afterSignOutUrl="/" />
                </div>
              </SignedIn>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
