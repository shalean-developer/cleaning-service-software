const MS_24H = 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;

export type SupportRequestStaleFlags = {
  staleOpen24h: boolean;
  staleAcknowledged48h: boolean;
};

export function computeSupportRequestStaleFlags(input: {
  status: string;
  createdAt: string;
  updatedAt: string;
}): SupportRequestStaleFlags {
  const now = Date.now();
  const createdMs = new Date(input.createdAt).getTime();
  const updatedMs = new Date(input.updatedAt).getTime();

  return {
    staleOpen24h: input.status === "open" && now - createdMs > MS_24H,
    staleAcknowledged48h:
      input.status === "acknowledged" && now - updatedMs > MS_48H,
  };
}
