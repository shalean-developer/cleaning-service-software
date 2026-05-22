"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useState } from "react";
import {
  applyManualUserArea,
  detectUserArea,
  redetectUserArea,
} from "@/features/locations/detectUserArea";
import {
  DETECTING_USER_AREA_LABEL,
  FALLBACK_USER_AREA_LABEL,
  getCachedUserArea,
} from "@/features/locations/resolveUserArea";
import { HeroLocationPickerModal } from "./HeroLocationPickerModal";
import { IconMapPin } from "./icons";

type HeroUserLocationLabelProps = {
  onChangeLocationClassName?: string;
};

export function HeroUserLocationLabel({
  onChangeLocationClassName = "marketing-focus-ring font-normal text-shalean-navy underline decoration-slate-400 underline-offset-[3px] transition hover:decoration-shalean-navy",
}: HeroUserLocationLabelProps) {
  const statusId = useId();
  const [displayLabel, setDisplayLabel] = useState(DETECTING_USER_AREA_LABEL);
  const [selectedAreaName, setSelectedAreaName] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const applyResolvedLabel = useCallback((areaName: string, label: string) => {
    setSelectedAreaName(areaName);
    setDisplayLabel(label);
    setIsDetecting(false);
  }, []);

  const runDetection = useCallback(async (forceRedetect = false) => {
    setIsDetecting(true);
    setDisplayLabel(DETECTING_USER_AREA_LABEL);

    const resolved = forceRedetect ? await redetectUserArea() : await detectUserArea();
    applyResolvedLabel(resolved.areaName, resolved.displayLabel);
  }, [applyResolvedLabel]);

  useLayoutEffect(() => {
    const cached = getCachedUserArea();
    if (cached) {
      applyResolvedLabel(cached.areaName, cached.displayLabel);
    }
  }, [applyResolvedLabel]);

  useEffect(() => {
    if (getCachedUserArea()) return;
    void runDetection(false);
  }, [runDetection]);

  const handleOpenPicker = () => {
    setPickerOpen(true);
  };

  const handleSelectArea = (areaName: string) => {
    const resolved = applyManualUserArea(areaName);
    applyResolvedLabel(resolved.areaName, resolved.displayLabel);
    setPickerOpen(false);
  };

  const handleUseCurrentLocation = () => {
    void (async () => {
      setIsDetecting(true);
      setDisplayLabel(DETECTING_USER_AREA_LABEL);
      const resolved = await redetectUserArea();
      applyResolvedLabel(resolved.areaName, resolved.displayLabel);
      if (resolved.displayLabel !== FALLBACK_USER_AREA_LABEL) {
        setPickerOpen(false);
      }
    })();
  };

  return (
    <>
      <span className="inline-flex items-center gap-1.5 font-semibold text-shalean-navy">
        <IconMapPin className="h-4 w-4 shrink-0" aria-hidden />
        <span id={statusId} aria-live="polite" aria-busy={isDetecting}>
          {displayLabel}
        </span>
      </span>
      <button
        type="button"
        onClick={handleOpenPicker}
        className={onChangeLocationClassName}
        aria-haspopup="dialog"
        aria-expanded={pickerOpen}
        aria-describedby={statusId}
        aria-label={
          displayLabel === FALLBACK_USER_AREA_LABEL
            ? "Change location"
            : `Change location. Currently showing ${displayLabel}`
        }
      >
        Change location
      </button>

      <HeroLocationPickerModal
        open={pickerOpen}
        selectedAreaName={selectedAreaName}
        isDetecting={isDetecting}
        onClose={() => setPickerOpen(false)}
        onSelectArea={handleSelectArea}
        onUseCurrentLocation={handleUseCurrentLocation}
      />
    </>
  );
}
