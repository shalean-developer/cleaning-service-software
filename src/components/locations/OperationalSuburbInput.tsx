"use client";

import { getBookingLocationOptions } from "@/features/locations/locationRegistry";

const DATALIST_ID = "shalean-operational-suburbs";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  autoComplete?: string;
  "aria-invalid"?: boolean;
};

export function OperationalSuburbInput({
  id,
  value,
  onChange,
  className,
  autoComplete = "address-level3",
  "aria-invalid": ariaInvalid,
}: Props) {
  const options = getBookingLocationOptions();

  return (
    <>
      <input
        id={id}
        list={DATALIST_ID}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
      />
      <datalist id={DATALIST_ID}>
        {options.map((opt) => (
          <option key={opt.slug} value={opt.label} />
        ))}
      </datalist>
    </>
  );
}
