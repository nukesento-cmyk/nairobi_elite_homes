// Invented data for building the funnel. Every card shows a "Sample" badge.
// Sprint 2 replaces this file with real listings from the CMS.
export type SampleListing = {
  id: string;
  vertical: "residential" | "land";
  title: string;
  area: string;
  price: { amount: number; currency: "KES"; period: "sale" | "month" };
  specs: { beds?: number; baths?: number; acreage?: number };
};

export const sampleListings: SampleListing[] = [
  { id: "s1", vertical: "residential", title: "Sample family home", area: "Karen", price: { amount: 85000000, currency: "KES", period: "sale" }, specs: { beds: 5, baths: 5 } },
  { id: "s2", vertical: "land", title: "Sample half-acre plot", area: "Runda", price: { amount: 60000000, currency: "KES", period: "sale" }, specs: { acreage: 0.5 } },
  { id: "s3", vertical: "residential", title: "Sample apartment", area: "Kilimani", price: { amount: 180000, currency: "KES", period: "month" }, specs: { beds: 3, baths: 3 } },
  { id: "s4", vertical: "residential", title: "Sample townhouse", area: "Lavington", price: { amount: 42000000, currency: "KES", period: "sale" }, specs: { beds: 4, baths: 4 } },
  { id: "s5", vertical: "residential", title: "Sample garden villa", area: "Muthaiga", price: { amount: 120000000, currency: "KES", period: "sale" }, specs: { beds: 6, baths: 6 } },
  { id: "s6", vertical: "land", title: "Sample one-acre plot", area: "Karen", price: { amount: 75000000, currency: "KES", period: "sale" }, specs: { acreage: 1 } },
  { id: "s7", vertical: "residential", title: "Sample duplex", area: "Rosslyn", price: { amount: 350000, currency: "KES", period: "month" }, specs: { beds: 4, baths: 4 } },
  { id: "s8", vertical: "residential", title: "Sample penthouse", area: "Kilimani", price: { amount: 38000000, currency: "KES", period: "sale" }, specs: { beds: 3, baths: 3 } },
  { id: "s9", vertical: "land", title: "Sample two-acre plot", area: "Rosslyn", price: { amount: 140000000, currency: "KES", period: "sale" }, specs: { acreage: 2 } },
];
