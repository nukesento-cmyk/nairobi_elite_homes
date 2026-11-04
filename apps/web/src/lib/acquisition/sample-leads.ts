import type { ReportLead } from "./report";

/** Invented, to preview the format. Reserved example domains, and never written to the database. */
export const SAMPLE_LEADS: ReportLead[] = [
  {
    score: 84,
    prospect: "Sample Heights Developers Ltd (invented)",
    category: "Developer, campaign C",
    property: "40 flats, Kilimani. Price not stated",
    classification: "developer_of_record, unverified",
    evidence: "Now selling, 40 units, completion Q2 2027",
    sourceUrl: "https://example.com/sample-heights",
  },
  {
    score: 71,
    prospect: "Example Property Managers (invented)",
    category: "Management company, campaign E",
    property: "Mixed portfolio, Westlands and Parklands",
    classification: "representative, self-declared",
    evidence: "We manage 12 residential blocks",
    sourceUrl: "https://example.org/about",
  },
];
