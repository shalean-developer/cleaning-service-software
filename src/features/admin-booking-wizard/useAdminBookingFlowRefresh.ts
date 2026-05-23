"use client";

import { useCallback, useEffect, useRef } from "react";
import { mergeAdminBookingFlowFromServerDetail } from "./adminBookingFlowSync";
import type { AdminBookingFlowSnapshot } from "./adminBookingFlowState";
import { fetchAdminBookingWizardFlowDetail } from "./api";

const POLL_INTERVAL_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 800;

export function useAdminBookingFlowRefresh(
  flow: AdminBookingFlowSnapshot,
  onFlowChange: (flow: AdminBookingFlowSnapshot) => void,
  options?: { pollWhileAwaitingPayment?: boolean },
) {
  const flowRef = useRef(flow);
  flowRef.current = flow;

  const inFlightRef = useRef<Promise<void> | null>(null);
  const debounceRef = useRef<number | null>(null);
  const pendingBookingIdRef = useRef<string | null>(null);

  const runRefresh = useCallback(
    async (bookingId: string) => {
      if (inFlightRef.current) {
        pendingBookingIdRef.current = bookingId;
        return inFlightRef.current;
      }

      const task = (async () => {
        const result = await fetchAdminBookingWizardFlowDetail(bookingId);
        if (result.ok) {
          onFlowChange(mergeAdminBookingFlowFromServerDetail(flowRef.current, result.booking));
        }
      })();

      inFlightRef.current = task;
      try {
        await task;
      } finally {
        inFlightRef.current = null;
        const pending = pendingBookingIdRef.current;
        pendingBookingIdRef.current = null;
        if (pending && pending !== bookingId) {
          void runRefresh(pending);
        }
      }
    },
    [onFlowChange],
  );

  const refresh = useCallback(
    async (bookingId?: string) => {
      const id =
        bookingId ??
        flowRef.current.pendingPayment?.bookingId ??
        flowRef.current.saved?.bookingId;
      if (!id) return;

      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }

      await new Promise<void>((resolve) => {
        debounceRef.current = window.setTimeout(() => {
          debounceRef.current = null;
          void runRefresh(id).finally(resolve);
        }, REFRESH_DEBOUNCE_MS);
      });
    },
    [runRefresh],
  );

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

    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      void runRefresh(bookingId);
    };

    const handle = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [
    flow.pendingPayment?.bookingId,
    flow.saved?.bookingId,
    flow.serverStatus?.bookingConfirmed,
    options?.pollWhileAwaitingPayment,
    runRefresh,
  ]);

  return { refresh };
}
