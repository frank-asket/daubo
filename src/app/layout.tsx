import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daubo — Career workspace for tailored applications & interview practice",
  description:
    "Save jobs, refine your materials from your real résumé, apply on official sites yourself, and practice interviews—with optional Gmail drafts you send when ready. Built for any sector.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <body className="flex min-h-full flex-col bg-black font-sans text-zinc-50">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
