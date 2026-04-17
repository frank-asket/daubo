#!/usr/bin/env node

const targetArg = process.argv.find((a) => a.startsWith("--target="));
const target = targetArg ? targetArg.split("=")[1] : "";

const REQUIRED_BY_TARGET = {
  vercel: [
    "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "CLERK_SECRET_KEY",
    "DAUBO_API_URL",
    "DAUBO_INTERNAL_API_SECRET",
  ],
  railway: [
    "DATABASE_URL",
    "BACKEND_CORS_ORIGINS",
    "DAUBO_INTERNAL_API_SECRET",
    "OPENROUTER_API_KEY",
  ],
};

if (!Object.prototype.hasOwnProperty.call(REQUIRED_BY_TARGET, target)) {
  console.error(
    "Usage: node scripts/check-required-env.mjs --target=<vercel|railway>",
  );
  process.exit(2);
}

const required = REQUIRED_BY_TARGET[target];
const missing = required.filter((name) => {
  const value = process.env[name];
  return !value || !value.trim();
});

if (missing.length > 0) {
  console.error(`Missing required ${target} environment variables:`);
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

console.log(
  `Environment validation passed for ${target}. Checked ${required.length} variable(s).`,
);
