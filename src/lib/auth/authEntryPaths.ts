/** Public role-selection entry before sign-in / sign-up flows. */
export const AUTH_PATH = "/auth" as const;

/** Customer sign-in entry (redirects to canonical `/sign-in`). */
export const CUSTOMER_LOGIN_ENTRY_PATH = "/login?role=customer" as const;

/** Customer registration entry (redirects to canonical `/sign-up`). */
export const SIGNUP_ENTRY_PATH = "/signup" as const;

/** Cleaner sign-in entry (redirects to cleaner-oriented `/sign-in`). */
export const CLEANER_LOGIN_ENTRY_PATH = "/cleaner/login" as const;

/** Cleaner recruitment entry (redirects to `/apply`). */
export const CAREERS_PATH = "/careers" as const;
