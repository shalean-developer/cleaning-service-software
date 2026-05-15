import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database/types";
import { getSupabasePublicEnv } from "@/lib/supabase/publicEnv";

export async function middleware(request: NextRequest) {
  const env = getSupabasePublicEnv();
  const response = NextResponse.next({ request });

  if (!env) {
    response.headers.set("x-auth-enforcement", "disabled");
    return response;
  }

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
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin") && profile?.role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (path.startsWith("/cleaner") && profile?.role !== "cleaner") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  if (path.startsWith("/customer") && profile?.role !== "customer") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/customer/:path*", "/admin/:path*", "/cleaner/:path*"],
};
