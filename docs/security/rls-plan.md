# Row Level Security (RLS) plan — Shalean foundation

RLS is **deferred** in `20260515201500_core_foundation.sql` by design. Before any production exposure of the Supabase Data API to browsers or untrusted clients, enable RLS on **every** `public` table listed below.

## Principles

1. **Never authorize from `user_metadata` / `raw_user_meta_data`.** Use `profiles.role` (backed by controlled writes) or `app_metadata` patterns per Supabase security guidance.  
2. **UPDATE needs a matching SELECT policy** or updates silently affect zero rows.  
3. **Append-only tables** (`booking_state_audit`): policies should allow `INSERT` only for trusted roles (often **no** direct insert from `authenticated` — only `service_role` via RPC / edge functions).  
4. **`security definer` RPCs** in `public`: keep minimal; prefer `security invoker` where possible, or move to a private schema. Current `booking_*` RPCs are `security definer` — **execute granted only to `service_role`** in the migration; re-audit before widening.

## Table-by-table intent (draft)

| Table | authenticated (customer) | authenticated (cleaner) | authenticated (admin) | service_role |
|-------|---------------------------|-------------------------|-------------------------|--------------|
| `profiles` | `select/update` own row only | same | same + controlled admin policy if needed | maintenance |
| `customers` | rows where `profile_id = auth.uid()` | deny | full read/write | maintenance |
| `cleaners` | deny | own row via `profile_id` | read all | maintenance |
| `bookings` | own `customer_id` | assigned or offered | read/update per support policy | command executor |
| `payments` | read own booking’s payments | deny | read | webhook + executor |
| `assignment_offers` | deny read others | offers to self | read/write | executor |
| `booking_state_audit` | read own booking’s audit | read if involved | read | insert via RPC |
| `notification_outbox` | deny | deny | deny | workers only |
| `earning_lines` | deny | own `cleaner_id` | read | executor |

## Implementation order

1. Enable RLS **without** policies (blocks all) on staging.  
2. Add narrow `SELECT` policies for `profiles` + `customers` join chain.  
3. Add booking `SELECT` scoped by `customer_id` / `cleaner_id`.  
4. **Deny** direct `UPDATE` on `bookings.status` from `authenticated`; mutations only via RPC / server actions using service role (or tightly scoped `security definer` function with internal checks).  
5. Run Supabase advisors + fix warnings.

## Blockers

- Customer/cleaner scoping requires stable FK resolution (`customers.profile_id`, `cleaners.profile_id`) in policies — already in schema.  
- Until command executor runs exclusively server-side with service role, enabling strict RLS will break the app — ship executor adapter first.
