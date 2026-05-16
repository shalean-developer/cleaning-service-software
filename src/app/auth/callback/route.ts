import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database/types";
import { resolvePostSignInPath, SIGN_IN_PATH } from "@/lib/auth/redirects";
import type { UserRole } from "@/lib/database/types";
import { getSupabasePublicEnv } from "@/lib/supabase/publicEnv";

/**
 * Exchanges an auth code for a session (magic link / OAuth / PKCE).
 * Email/password sign-in does not require this route.
 */
export async function GET(request: NextRequest) {
  const env = getSupabasePublicEnv();
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirectedFrom = requestUrl.searchParams.get("redirectedFrom");

  if (!env || !code) {
    return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
  }

  const cookieStore = await cookies();
  let destination: string = SIGN_IN_PATH;

  const supabase = createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const signInUrl = new URL(SIGN_IN_PATH, request.url);
    signInUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(signInUrl);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role as UserRole | undefined;
    if (role) {
      destination = resolvePostSignInPath(role, redirectedFrom);
    }
  }

  const response = NextResponse.redirect(new URL(destination, request.url));
  return response;
}
