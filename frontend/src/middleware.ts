import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function decodeJwtPayload(token?: string) {
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    return null;
  }

  try {
    const normalized = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as { exp?: number };
  } catch {
    return null;
  }
}

function hasUsableAccessToken(token?: string) {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) {
    return false;
  }

  return payload.exp * 1000 > Date.now();
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const destination = request.nextUrl.pathname + request.nextUrl.search;
  if (destination !== "/" && destination !== "/login") {
    loginUrl.searchParams.set("redirect", destination);
  }
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("acr_access_token");
  response.cookies.delete("acr_refresh_token");
  return response;
}

export function middleware(request: NextRequest) {
  const accessToken = request.cookies.get("acr_access_token")?.value;
  const refreshToken = request.cookies.get("acr_refresh_token")?.value;
  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");
  const hasValidAccessToken = hasUsableAccessToken(accessToken);

  if (isLoginRoute) {
    if (hasValidAccessToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.next();
  }

  const isProtected = !pathname.startsWith("/_next") && !pathname.startsWith("/favicon");
  if (!isProtected) {
    return NextResponse.next();
  }

  if (hasValidAccessToken || refreshToken) {
    return NextResponse.next();
  }

  return redirectToLogin(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
