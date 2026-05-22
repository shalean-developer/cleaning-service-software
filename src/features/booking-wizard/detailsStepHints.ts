import {
  CLEANING_EQUIPMENT_FEE_CENTS,
  TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS,
} from "@/features/pricing/server/catalog";
import type { EquipmentSupply } from "@/features/pricing/server/types";
import { formatAddonPrice } from "./format";

export function equipmentSupplyVisibleHint(supply: EquipmentSupply): string {
  if (supply === "shalean") {
    return `Shalean supplies equipment · ${formatAddonPrice(CLEANING_EQUIPMENT_FEE_CENTS)}`;
  }
  return "";
}

export function teamSupportVisibleHint(requestedTeamSize: 1 | 2): string {
  if (requestedTeamSize === 2) {
    return `Team support request · ${formatAddonPrice(TEAM_SUPPORT_REQUEST_SURCHARGE_CENTS)} · availability confirmed after payment`;
  }
  return "";
}
