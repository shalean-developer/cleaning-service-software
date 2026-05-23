"use client";

import { useCallback, useState } from "react";

type Props = {
  url: string;
  label?: string;
  className?: string;
};

export function AdminZohoCopyLinkButton({
  url,
  label = "Copy link",
  className = "",
}: Props) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = useCallback(async () => {
    setError(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed");
    }
  }, [url]);

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button
        type="button"
        onClick={copy}
        className={`rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 ${className}`}
      >
        {copied ? "Copied" : label}
      </button>
      {error ? <span className="text-[10px] text-red-600">{error}</span> : null}
    </span>
  );
}

export function AdminZohoOpenLinkButton({
  url,
  label = "Open",
  className = "",
}: Props) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 ${className}`}
    >
      {label}
    </a>
  );
}
