import Link from "next/link";
import { Logo } from "@/components/Logo";
import { FooterLegalLinks } from "@/components/landing/FooterLegalLinks";
import { productName } from "@/lib/customer-config";

export function FooterCTA() {
  return (
    <section className="bg-black px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl rounded-2xl border border-cyan-500/50 bg-black px-8 py-14 text-center sm:px-12 sm:py-16">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Ready to organize your next career move?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
          Track roles, refine what you send employers, and practice interviews—without giving up control
          of where or how you apply.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-9 py-3.5 text-sm font-semibold text-zinc-950 shadow-[0_0_48px_-8px_rgba(52,211,153,0.55)] transition hover:opacity-95"
        >
          Get started now
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-black pb-12 pt-10">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
        <div className="sm:col-span-2 lg:col-span-1">
          <Logo href="/" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-zinc-500">
            Save jobs, shape application materials from your résumé, apply on official sites yourself,
            and use optional Gmail drafts you review before anything goes out.
          </p>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Daubo</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-500">
            <li>
              <a href="#why" className="hover:text-zinc-300">
                Why Daubo?
              </a>
            </li>
            <li>
              <a href="#product" className="hover:text-zinc-300">
                Product
              </a>
            </li>
            <li>
              <a href="#how" className="hover:text-zinc-300">
                How it works
              </a>
            </li>
            <li>
              <Link href="/pricing" className="hover:text-zinc-300">
                Plans
              </Link>
            </li>
            <li>
              <a href="#faq" className="hover:text-zinc-300">
                FAQ
              </a>
            </li>
            <li>
              <Link href="/dashboard" className="hover:text-zinc-300">
                Open app
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Legal &amp; support</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-500">
            <FooterLegalLinks />
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Product</p>
          <ul className="mt-4 space-y-2 text-sm text-zinc-500">
            <li>
              <Link href="/auth/sign-in" className="hover:text-zinc-300">
                Sign in
              </Link>
            </li>
            <li>
              <Link href="/auth/sign-up" className="hover:text-zinc-300">
                Create account
              </Link>
            </li>
            <li>
              <Link href="/dashboard/settings" className="hover:text-zinc-300">
                Account settings
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-12 text-center text-xs text-zinc-600">
        © {new Date().getFullYear()} {productName()}. All rights reserved.
      </p>
    </footer>
  );
}
