import type { EarningPayoutStatus } from "@/lib/database/types";
import type { AdminEarningsPayoutStatus } from "./adminEarningsDisplay";

export function mapEarningPayoutStatusToUi(
  status: EarningPayoutStatus,
): AdminEarningsPayoutStatus {
  switch (status) {
    case "pending":
      return "held";
    case "payout_ready":
      return "scheduled";
    case "paid":
      return "released";
  }
}
