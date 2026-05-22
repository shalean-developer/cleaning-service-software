"use client";

import { OperationalAreaPicker } from "@/components/locations/OperationalAreaPicker";

type Props = {
  name?: string;
  rows?: number;
  placeholder?: string;
  className?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  "aria-invalid"?: boolean;
};

export function AdminServiceAreasTextarea({
  value,
  onChange,
  onBlur,
  "aria-invalid": ariaInvalid,
  className,
}: Props) {
  return (
    <OperationalAreaPicker
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      aria-invalid={ariaInvalid}
      textareaClassName={className}
    />
  );
}
