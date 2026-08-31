import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/*
 * Edge-safe base config, shared by the full server config (src/auth.ts) and the
 * middleware. It deliberately excludes the Prisma adapter and the Credentials
 * provider (both pull in Node-only code — Prisma, bcrypt — that can't run in the
 * edge middleware runtime). Google is edge-safe and reads AUTH_GOOGLE_ID /
 * AUTH_GOOGLE_SECRET from the environment automatically.
 */
export default {
  // Self-hosted (not on Vercel): trust the deployment host. Auth.js auto-trusts
  // only under `next dev`; `next start` / production needs this set explicitly,
  // otherwise every /api/auth/* request fails with UntrustedHost.
  trustHost: true,
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [Google],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : "";
        session.user.username =
          typeof token.username === "string" ? token.username : null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
