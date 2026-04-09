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
  title: "Daubo — Global job search & resume assistant for every sector",
  description:
    "Country-aware discovery for any industry: match openings to your profile, generate a personalized resume per offer, and apply from your own email after you approve—with interview prep in the same workspace.",
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
