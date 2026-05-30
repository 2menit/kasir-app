import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Route protection (CON-01, CON-02, CON-07):
 *  - Every matched route requires a valid session.
 *  - /superadmin/* requires SUPERADMIN.
 *  - /user/* requires USER (superadmin has their own area).
 * API routes enforce their own role checks server-side; middleware guards pages.
 */
export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/superadmin") && role !== "SUPERADMIN") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    if (pathname.startsWith("/user") && role !== "USER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/login" },
  }
);

export const config = {
  matcher: ["/dashboard", "/superadmin/:path*", "/user/:path*"],
};
