import type { Metadata } from "next";
import Link from "next/link";
import { ChefHat } from "lucide-react";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export const metadata: Metadata = { title: "Create an account" };

export default function RegisterPage() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12">
      <div className="mb-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-semibold tracking-tight"
        >
          <ChefHat className="size-6 text-primary" />
          Ciba Library
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Join the library
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create an account to share recipes and build your collection.
        </p>
      </div>
      <GoogleSignInButton />
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <RegisterForm />
    </div>
  );
}
