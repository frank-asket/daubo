import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Daubo — Multi-agent job search & resume assistant",
  description:
    "Match jobs to your profile, generate a personalized resume per offer, and apply from your own email after you approve—with interview prep in the same workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-black font-sans text-zinc-50">
        {children}
      </body>
    </html>
  );
}
