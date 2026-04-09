"use client";

import { useUser } from "@clerk/nextjs";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ProfileDocumentsSection } from "@/components/dashboard/ProfileDocumentsSection";

export function ProfileOverview() {
  const { user, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="flex items-center gap-2 text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading profile…
      </div>
    );
  }

  if (!user) {
    return <p className="text-sm text-zinc-500">Sign in to see your Daubo profile.</p>;
  }

  const primary = user.emailAddresses[0]?.emailAddress;

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Account</p>
        <div className="flex flex-wrap items-center gap-4">
          {user.imageUrl ? (
            <Image
              src={user.imageUrl}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-2xl border border-zinc-800 object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900 text-lg font-semibold text-white">
              {(user.firstName ?? user.username ?? "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-lg font-semibold text-white">
              {user.fullName ?? user.username ?? "Daubo member"}
            </h2>
            {primary ? <p className="text-sm text-zinc-500">{primary}</p> : null}
            {user.primaryPhoneNumber?.phoneNumber ? (
              <p className="text-sm text-zinc-500">{user.primaryPhoneNumber.phoneNumber}</p>
            ) : null}
          </div>
        </div>
        <p className="max-w-xl text-sm text-zinc-500">
          Name and avatar come from your sign-in provider. Change password, connected accounts, or subscription in{" "}
          <Link href="/dashboard/settings" className="font-semibold text-emerald-400 hover:underline">
            Settings
          </Link>
          . Your career materials live under{" "}
          <Link href="/dashboard/resume" className="font-semibold text-emerald-400 hover:underline">
            Résumé
          </Link>{" "}
          and{" "}
          <Link href="/dashboard/applications" className="font-semibold text-emerald-400 hover:underline">
            My jobs
          </Link>
          .
        </p>
      </section>

      <ProfileDocumentsSection />
    </div>
  );
}
