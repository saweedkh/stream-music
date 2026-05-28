import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/login", "/register"]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/sw.js") {
    return NextResponse.next();
  }
  const hasSession = request.cookies.has("sessionid");

  if (PUBLIC_PATHS.has(pathname)) {
    if (hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    const nextTarget = pathname === "/" ? "/dashboard" : `${pathname}${request.nextUrl.search}`;
    loginUrl.searchParams.set("next", nextTarget);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Important: include "/" explicitly. Depending on path-to-regexp normalization,
  // Next middleware matcher can miss the root path and you end up with a 404.
  matcher: ["/", "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp)$).*)"],
};
