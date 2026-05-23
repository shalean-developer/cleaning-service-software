export type SaveAdminBookingDraftResponse =
  | {
      ok: true;
      bookingDraft: {
        bookingId: string;
        status: "draft";
        priceCents: number;
        currency: string;
        idempotent: boolean;
      };
      customerId?: string;
    }
  | { ok: false; error: string; message: string };

export async function saveAdminBookingDraft(
  body: Record<string, unknown>,
): Promise<SaveAdminBookingDraftResponse> {
  const response = await fetch("/api/admin/bookings/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = (await response.json()) as SaveAdminBookingDraftResponse;
  return json;
}
