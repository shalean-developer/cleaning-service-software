"use client";

import { useCallback, useEffect, useRef } from "react";
import { mergeAdminBookingFlowFromServerDetail } from "./adminBookingFlowSync";
import type { AdminBookingFlowSnapshot } from "./adminBookingFlowState";
import { fetchAdminBookingWizardFlowDetail } from "./api";

export function useAdminBookingFlowRefresh(
  flow: AdminBookingFlowSnapshot,
  onFlowChange: (flow: AdminBookingFlowSnapshot) => void,
  options?: { pollWhileAwaitingPayment?: boolean },
) {
  const flowRef = useRef(flow);
  flowRef.current = flow;

  const refresh = useCallback(async (bookingId?: string) => {
    const id =
      bookingId ??
      flowRef.current.pendingPayment?.bookingId ??
      flowRef.current.saved?.bookingId;
    if (!id) return;

    const result = await fetchAdminBookingWizardFlowDetail(id);
    if (!result.ok) return;
    onFlowChange(mergeAdminBookingFlowFromServerDetail(flowRef.current, result.booking));
  }, [onFlowChange]);

  useEffect(() => {
    const bookingId = flow.pendingPayment?.bookingId ?? flow.saved?.bookingId;
    if (!bookingId) return;
    void refresh(bookingId);
  }, [flow.pendingPayment?.bookingId, flow.saved?.bookingId, refresh]);

  useEffect(() => {
    if (!options?.pollWhileAwaitingPayment) return;
    const bookingId = flow.pendingPayment?.bookingId ?? flow.saved?.bookingId;
    if (!bookingId) return;
    if (flow.serverStatus?.bookingConfirmed) return;

    const handle = window.setInterval(() => {
      void refresh(bookingId);
    }, 12_000);

    return () => window.clearInterval(handle);
  }, [
    flow.pendingPayment?.bookingId,
    flow.saved?.bookingId,
    flow.serverStatus?.bookingConfirmed,
    options?.pollWhileAwaitingPayment,
    refresh,
  ]);

  return { refresh };
}
