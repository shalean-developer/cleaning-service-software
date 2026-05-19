import type { User } from "@supabase/supabase-js";
import type { CurrentUser } from "@/lib/auth/types";
import type { UserRole } from "@/lib/database/types";

export function testSupabaseUser(partial: Partial<User> = {}): User {
  return {
    id: partial.id ?? "auth-user-test-1",
    aud: "authenticated",
    role: "authenticated",
    email: partial.email ?? "test@example.com",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
    ...partial,
  } as User;
}

export function testCurrentUser(
  partial: Partial<Omit<CurrentUser, "authUser">> & {
    authUser?: Partial<User>;
  } = {},
): CurrentUser {
  const { authUser: authPartial, ...rest } = partial;
  return {
    profileId: rest.profileId ?? "profile-test-1",
    role: (rest.role ?? "admin") as UserRole,
    authUser: testSupabaseUser(authPartial),
  };
}
