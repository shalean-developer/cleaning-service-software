import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database/types";
import {
  buildSignInRedirectPath,
  homePathForRole,
  requiredRoleForDashboardPath,
} from "@/lib/auth/redirects";
import { getSupabasePublicEnv } from "@/lib/supabase/publicEnv";

export async function middleware(request: NextRequest) {
  const env = getSupabasePublicEnv();
  const pathname = request.nextUrl.pathname;

  if (!env) {
    const signInUrl = new URL(
      buildSignInRedirectPath(pathname),
      request.url,
    );
    return NextResponse.redirect(signInUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const signInUrl = new URL(
      buildSignInRedirectPath(pathname),
      request.url,
    );
    return NextResponse.redirect(signInUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.role) {
    const signInUrl = new URL(
      buildSignInRedirectPath(pathname),
      request.url,
    );
    return NextResponse.redirect(signInUrl);
  }

  const requiredRole = requiredRoleForDashboardPath(pathname);
  if (requiredRole && profile.role !== requiredRole) {
    return NextResponse.redirect(
      new URL(homePathForRole(profile.role), request.url),
    );
  }

  return response;
}

export const config = {
  matcher: ["/customer/:path*", "/admin/:path*", "/cleaner/:path*"],
};
