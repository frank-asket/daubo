import Link from "next/link";
import { bookingUrl, privacyUrl, supportEmail, termsUrl } from "@/lib/customer-config";

/** Customer-facing legal & contact links when env vars are set. */
export function FooterLegalLinks() {
  const terms = termsUrl();
  const privacy = privacyUrl();
  const email = supportEmail();
  const book = bookingUrl();

  if (!terms && !privacy && !email && !book) {
    return (
      <li>
        <Link href="/dashboard/support" className="hover:text-zinc-300">
          Help &amp; support
        </Link>
      </li>
    );
  }

  return (
    <>
      {terms ? (
        <li>
          <a href={terms} target="_blank" rel="noreferrer" className="hover:text-zinc-300">
            Terms of service
          </a>
        </li>
      ) : null}
      {privacy ? (
        <li>
          <a href={privacy} target="_blank" rel="noreferrer" className="hover:text-zinc-300">
            Privacy
          </a>
        </li>
      ) : null}
      {email ? (
        <li>
          <a href={`mailto:${encodeURIComponent(email)}`} className="hover:text-zinc-300">
            {email}
          </a>
        </li>
      ) : null}
      {book ? (
        <li>
          <a href={book} target="_blank" rel="noreferrer" className="hover:text-zinc-300">
            Book a call
          </a>
        </li>
      ) : null}
      <li>
        <Link href="/dashboard/support" className="hover:text-zinc-300">
          In-app help
        </Link>
      </li>
    </>
  );
}
