import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database/types";
import {
  buildSignInRedirectPath,
  homePathForRole,
  requiredRoleForDashboardPath,
} from "@/lib/auth/redirects";
import { isStaleRefreshTokenError } from "@/lib/auth/sessionErrors";
import { isSupabaseAuthCookieName } from "@/lib/auth/supabaseAuthCookie";
import { getSupabasePublicEnv } from "@/lib/supabase/publicEnv";

/** Copies Set-Cookie headers from the session response onto a redirect. */
function redirectWithSessionCookies(
  url: URL,
  sessionResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  for (const cookie of sessionResponse.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }
  return redirectResponse;
}

function clearSupabaseAuthCookiesOnResponse(
  request: NextRequest,
  response: NextResponse,
): void {
  for (const { name } of request.cookies.getAll()) {
    if (isSupabaseAuthCookieName(name)) {
      response.cookies.delete(name);
    }
  }
}

export async function proxy(request: NextRequest) {
  const env = getSupabasePublicEnv();
  const pathname = request.nextUrl.pathname;

  if (!env) {
    const signInUrl = new URL(buildSignInRedirectPath(pathname), request.url);
    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  let sessionResponse = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        sessionResponse = NextResponse.next({
          request: { headers: requestHeaders },
        });
        for (const { name, value, options } of cookiesToSet) {
          sessionResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError && isStaleRefreshTokenError(authError)) {
    clearSupabaseAuthCookiesOnResponse(request, sessionResponse);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore. auth cookies are cleared on the response.
    }
    const signInUrl = new URL(buildSignInRedirectPath(pathname), request.url);
    return redirectWithSessionCookies(signInUrl, sessionResponse);
  }

  if (!user) {
    const signInUrl = new URL(buildSignInRedirectPath(pathname), request.url);
    return redirectWithSessionCookies(signInUrl, sessionResponse);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) {
    const signInUrl = new URL(buildSignInRedirectPath(pathname), request.url);
    return redirectWithSessionCookies(signInUrl, sessionResponse);
  }

  const requiredRole = requiredRoleForDashboardPath(pathname);
  if (requiredRole && profile.role !== requiredRole) {
    const roleHomeUrl = new URL(homePathForRole(profile.role), request.url);
    return redirectWithSessionCookies(roleHomeUrl, sessionResponse);
  }

  return sessionResponse;
}

export const config = {
  matcher: ["/customer/:path*", "/admin/:path*", "/cleaner/:path*"],
};
