import {
  CLEANING_EQUIPMENT_FEE_CENTS,
  SERVICE_CATALOG,
  TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS,
} from "@/features/pricing/server/catalog";
import type { EquipmentSupply } from "@/features/pricing/server/types";
import { formatAddonPrice } from "./format";

/** Display-only surcharge copy — amounts mirror catalog constants, not pricing logic. */
const extraRoomUnitCents = SERVICE_CATALOG["regular-cleaning"].extraRoomCents ?? 7_000;

export const EXTRA_ROOMS_VISIBLE_HINT = `${formatAddonPrice(extraRoomUnitCents)} per extra room`;

export function equipmentSupplyVisibleHint(supply: EquipmentSupply): string {
  if (supply === "shalean") {
    return `Shalean supplies equipment · ${formatAddonPrice(CLEANING_EQUIPMENT_FEE_CENTS)}`;
  }
  return "You provide supplies & equipment";
}

export function teamSupportVisibleHint(requestedTeamSize: 1 | 2): string {
  if (requestedTeamSize === 2) {
    return `Team support request · ${formatAddonPrice(TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS)} · availability confirmed after payment`;
  }
  return "Standard single-cleaner visit";
}
