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
  title: "Daubo — Multi-agent resume matching & applications worldwide",
  description:
    "Daubo's agents match your resume to job offers worldwide—not manual searching—then tailor resumes and applications to each posting's requirements. Interview prep lives in the same workspace.",
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
