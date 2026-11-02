/** Requests to join, used to approximate monthly income. */
export type RequestStats = {
  total: number;
  pending: number;
  linkSent: number;
  declined: number;
  daily: { day: string; count: number }[];
};

export type BreadEstimate = {
  /** Everyone who asked and wasn't declined, if each paid the monthly price. */
  potential: number;
  potentialPeople: number;
  /** Only those who have been sent the link. */
  linkSent: number;
  price: number;
};

/** An estimate, not income: no payments are collected. Null until a price is set. */
export function estimateBread(stats: RequestStats, monthlyPrice: number | null): BreadEstimate | null {
  if (!monthlyPrice) return null;
  const potentialPeople = stats.total - stats.declined;
  return {
    potential: potentialPeople * monthlyPrice,
    potentialPeople,
    linkSent: stats.linkSent * monthlyPrice,
    price: monthlyPrice,
  };
}

export function formatBread(amount: number): string {
  return `KES ${amount.toLocaleString("en-US")}`;
}
