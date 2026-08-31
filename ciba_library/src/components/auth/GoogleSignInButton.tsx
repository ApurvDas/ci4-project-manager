"use client";

import { signInWithGoogle } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

/** Google's four-color "G" mark. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.06 12.25c0-.82-.07-1.6-.21-2.35H12v4.45h6.19a5.3 5.3 0 0 1-2.3 3.48v2.89h3.72c2.18-2 3.45-4.96 3.45-8.47z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.12 0 5.73-1.03 7.64-2.8l-3.72-2.88c-1.03.69-2.36 1.1-3.92 1.1-3.01 0-5.56-2.03-6.47-4.77H1.68v2.98A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.53 14.29a7.2 7.2 0 0 1 0-4.58V6.73H1.68a12 12 0 0 0 0 10.54l3.85-2.98z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.7 0 3.22.58 4.42 1.72l3.3-3.3C17.73 1.2 15.12 0 12 0A12 12 0 0 0 1.68 6.73l3.85 2.98C6.44 6.78 8.99 4.75 12 4.75z"
      />
    </svg>
  );
}

export function GoogleSignInButton() {
  return (
    <form action={signInWithGoogle}>
      <Button type="submit" variant="outline" className="w-full">
        <GoogleMark />
        Continue with Google
      </Button>
    </form>
  );
}
