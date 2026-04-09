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
  title: "Daubo — The platform for your next job or venture",
  description:
    "Daubo builds your professional profile and automates tailored drafts, pipeline tracking, and interview prep—whether you're chasing a dream job or starting something of your own. You review and submit on official channels; nothing goes out without you.",
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
