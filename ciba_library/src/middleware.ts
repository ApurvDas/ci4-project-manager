import NextAuth from "next-auth";
import authConfig from "@/auth.config";

/*
 * Route protection. Uses only the edge-safe config (no Prisma/bcrypt) so it can
 * run in the middleware runtime — it just checks for a valid session and
 * bounces signed-out users to /login with a callbackUrl to return to.
 */
const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ["/dashboard", "/recipes/new"];
const EDIT_PATH = /^\/recipes\/[^/]+\/edit$/;

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const needsAuth =
    PROTECTED_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    ) || EDIT_PATH.test(pathname);

  if (needsAuth && !req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", pathname);
    return Response.redirect(url);
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/recipes/new", "/recipes/:slug/edit"],
};
