"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from "@/lib/validation";

export type RegisterResult =
  | { ok: true }
  | { ok: false; error: string; field?: "email" | "username" };

export type AuthActionResult = { ok: true } | { ok: false; error: string };

/*
 * Create a credentials account: validate, ensure the email/username are free,
 * bcrypt-hash the password, and insert the user. Wired into the register form
 * in Phase 4; defined here so the hashing/uniqueness logic lives with the rest
 * of the backend foundation.
 */
export async function registerUser(input: unknown): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form and try again." };
  }

  const { name, username, email, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (existing) {
    return existing.email === email
      ? { ok: false, error: "That email is already registered.", field: "email" }
      : { ok: false, error: "That username is taken.", field: "username" };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, username, email, passwordHash },
  });

  return { ok: true };
}

/**
 * Verify an email + password and start a session. Returns a result object
 * (no redirect) so the client form can navigate to its callback URL itself.
 */
export async function signInWithCredentials(
  input: LoginInput,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Enter a valid email and password." };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Invalid email or password." };
    }
    throw error;
  }
}

/** Create an account and immediately sign the new user in. */
export async function registerAndSignIn(
  input: RegisterInput,
): Promise<RegisterResult> {
  const result = await registerUser(input);
  if (!result.ok) return result;

  try {
    await signIn("credentials", {
      email: input.email,
      password: input.password,
      redirect: false,
    });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    // Account exists but auto sign-in failed; the user can sign in manually.
  }
  return { ok: true };
}

/** Kick off the Google OAuth flow (redirects to Google, then back). */
export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/dashboard" });
}

/** End the current session and return home. */
export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
