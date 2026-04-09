import { dark } from "@clerk/themes";
import type { Appearance } from "@clerk/types";

export const clerkAppearance: Appearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#4ade80",
    colorBackground: "#0a0a0a",
    colorInputBackground: "#18181b",
    colorNeutral: "#a1a1aa",
  },
  elements: {
    rootBox: "w-full",
    card: "w-full bg-zinc-950 shadow-xl border border-zinc-800",
    headerTitle: "text-white",
    headerSubtitle: "text-zinc-400",
    socialButtonsBlockButton: "border-zinc-700 bg-zinc-900 text-white",
    formButtonPrimary: "bg-emerald-400 text-zinc-950 hover:bg-emerald-300",
    footerActionLink: "text-emerald-400 hover:text-emerald-300",
  },
};
