import type { DefaultSession } from "next-auth";

/*
 * Put our extra identity fields (id + username) on the session and user so
 * callers get them typed. Kept in one place; the callbacks in auth.config.ts
 * populate them.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    username?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string | null;
  }
}
