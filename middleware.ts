import { NextRequest, NextResponse } from "next/server";
import { verifySession, SESSION_COOKIE_NAME } from "@/lib/auth";

const PROTECTED_PATHS = ["/settings", "/reviews/new", "/reviews/*/edit"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PATHS.some((p) => {
    if (p.includes("*")) {
      const regex = new RegExp("^" + p.replace(/\*/g, "[^/]+"));
      return regex.test(pathname);
    }
    return pathname === p || pathname.startsWith(p + "/");
  });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!isProtected(pathname)) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  const session = await verifySession(token);
  if (!session) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/settings/:path*", "/reviews/new", "/reviews/:id/edit"],
};
