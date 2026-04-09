/**
 * Public deployment config for customers (set in Vercel / env — no secrets here).
 */
export function productName(): string {
  return process.env.NEXT_PUBLIC_PRODUCT_NAME?.trim() || "Daubo";
}

export function supportEmail(): string | null {
  const v = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim();
  return v || null;
}

export function termsUrl(): string | null {
  const v = process.env.NEXT_PUBLIC_TERMS_URL?.trim();
  return v || null;
}

export function privacyUrl(): string | null {
  const v = process.env.NEXT_PUBLIC_PRIVACY_URL?.trim();
  return v || null;
}

export function bookingUrl(): string | null {
  const v = process.env.NEXT_PUBLIC_BOOKING_URL?.trim();
  return v || null;
}
