import type { User } from "@supabase/supabase-js";
import type { UserRole } from "@/lib/database/types";

export type CurrentUser = {
  authUser: User;
  profileId: string;
  role: UserRole;
};
