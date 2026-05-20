/** Subtle trust and help copy for auth pages (presentation only). */
export function SignInTrustFooter() {
  return (
    <footer className="mt-6 border-t border-zinc-100 pt-5">
      <ul className="space-y-2.5 text-center text-xs leading-relaxed text-zinc-500">
        <li className="flex items-center justify-center gap-1.5">
          <svg
            className="h-3.5 w-3.5 shrink-0 text-zinc-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z"
            />
          </svg>
          Secure sign in
        </li>
        <li>Your bookings and payments are protected.</li>
        <li>
          Need help?{" "}
          <a
            href="mailto:support@shalean.co.za"
            className="font-medium text-zinc-600 underline-offset-2 transition-colors hover:text-zinc-900 hover:underline"
          >
            Contact support
          </a>
        </li>
      </ul>
    </footer>
  );
}
