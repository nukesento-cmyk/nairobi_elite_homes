// Starting copy for the community pages. Sanity documents with the same slug
// replace these. Deliberately free of prices and statistics, which would go stale
// and can't be verified from here: have someone local check it before launch.
export type Community = {
  slug: string;
  name: string;
  summary: string;
  intro: string;
  character: string[];
  suits: string[];
  checks: string[];
};

const LAND_TITLE_CHECK =
  "Run an official search at the Ministry of Lands and confirm the seller is the registered owner before paying anything.";

const COUNTY_ZONING_CHECK =
  "Confirm current zoning and any change-of-use approvals with Nairobi City County, not just the agent or seller.";

export const communities: Community[] = [
  {
    slug: "karen",
    name: "Karen",
    summary: "Leafy, low-density living on large plots in south-west Nairobi.",
    intro:
      "Karen is one of Nairobi's best-known low-density suburbs, known for mature trees, large plots and standalone homes. It takes its name from Karen Blixen, whose former home is now a museum in the area. Buyers usually come here for space and privacy, and accept a longer drive to the city centre in exchange.",
    character: [
      "Standalone homes on large, often half-acre or bigger, plots",
      "A quieter, greener feel than the central suburbs",
      "Shopping, schools and clubs within the suburb, including The Hub Karen",
      "Close to the Nairobi National Park side of the city",
    ],
    suits: [
      "Families who want a garden and room to grow",
      "Buyers looking for land to build on",
      "People who work from home or don't commute to the city centre daily",
    ],
    checks: [
      LAND_TITLE_CHECK,
      "Ask the Karen Langata District Association about local plot-size and development rules before planning to subdivide or build.",
      "Check water and sewer arrangements: many properties rely on boreholes and septic systems.",
      "Drive your actual commute at peak hours before committing.",
    ],
  },
  {
    slug: "runda",
    name: "Runda",
    summary: "A quiet, security-conscious estate near Gigiri and the UN offices.",
    intro:
      "Runda is an established residential estate in northern Nairobi, popular with diplomats, executives and families who want a controlled, residential setting. Its closeness to the UN complex in Gigiri, embassies and Village Market shapes much of its demand.",
    character: [
      "Large homes in a predominantly residential estate",
      "An active residents' association involved in estate matters",
      "Close to the UN offices in Gigiri, embassies and Village Market",
      "Popular with international families and long-stay tenants",
    ],
    suits: [
      "Diplomatic and international-organisation households",
      "Families who want a quiet, residential estate",
      "Landlords looking at the long-stay executive rental market",
    ],
    checks: [
      LAND_TITLE_CHECK,
      "Ask the residents' association about estate rules, levies and any restrictions on building.",
      "Confirm how the property gets its water and what security arrangements cost.",
      COUNTY_ZONING_CHECK,
    ],
  },
  {
    slug: "kilimani",
    name: "Kilimani",
    summary: "Central, fast-changing and dominated by modern apartments.",
    intro:
      "Kilimani sits close to the city centre and has changed quickly, with apartment blocks replacing many older houses. It suits people who want to be near offices, restaurants and shops such as Yaya Centre, and it draws both residents and rental investors.",
    character: [
      "Mostly apartments, with a growing number of high-rise developments",
      "A short distance from the CBD, Upper Hill and Westlands",
      "Plenty of restaurants, shops and short-stay rentals",
      "Busier and more urban than the outer suburbs",
    ],
    suits: [
      "Professionals who want a short commute",
      "Buy-to-let investors",
      "Diaspora buyers looking for a low-maintenance home in the city",
    ],
    checks: [
      "Confirm the developer's approvals, and for off-plan units, ask how your deposit is protected and what happens if the project is delayed.",
      "Ask for the block's service charge history and who manages the building.",
      "Check what's planned next door: new towers can change your light, view and access.",
      "Confirm the water supply and parking allocation in writing.",
    ],
  },
  {
    slug: "rosslyn",
    name: "Rosslyn",
    summary: "Green and residential, close to Gigiri, Village Market and international schools.",
    intro:
      "Rosslyn lies in northern Nairobi near Gigiri, and is known for gated communities, townhouses and family homes. Rosslyn Academy and nearby international schools, the UN complex and shopping at Village Market and Rosslyn Riviera make it popular with expatriate families.",
    character: [
      "Gated communities and townhouses alongside standalone homes",
      "A green, residential setting off Limuru Road",
      "Close to international schools and the UN complex",
      "Strong demand from long-stay international tenants",
    ],
    suits: [
      "Families who want to be near international schools",
      "Expatriate households working in Gigiri",
      "Buyers who prefer a managed gated community",
    ],
    checks: [
      LAND_TITLE_CHECK,
      "For gated communities, read the rules and ask for recent service charge accounts.",
      "Check the school run and Limuru Road traffic at the times you'd actually travel.",
      COUNTY_ZONING_CHECK,
    ],
  },
  {
    slug: "lavington",
    name: "Lavington",
    summary: "A central, family-friendly suburb where houses and new apartments sit side by side.",
    intro:
      "Lavington sits west of the city centre, between Kileleshwa and Kangemi. Once mainly bungalows on large plots, it now mixes older family homes with townhouses and newer apartment blocks. Its appeal is being close to town while still feeling residential.",
    character: [
      "A mix of older homes, townhouses and new apartments",
      "Shops and restaurants at Lavington Mall and Valley Arcade",
      "Well placed for Westlands, Kilimani and the CBD",
      "Several well-regarded schools nearby",
    ],
    suits: [
      "Families who want a central location",
      "Buyers upgrading from an apartment to a townhouse",
      "Developers and investors looking at changing plots",
    ],
    checks: [
      LAND_TITLE_CHECK,
      COUNTY_ZONING_CHECK,
      "Find out what's approved on neighbouring plots, since redevelopment is common here.",
      "Ask about water reliability and whether the property has a borehole or storage.",
    ],
  },
  {
    slug: "muthaiga",
    name: "Muthaiga",
    summary: "One of Nairobi's oldest prestige neighbourhoods, close to the city centre.",
    intro:
      "Muthaiga is among Nairobi's longest-established upmarket neighbourhoods, known for large homes on mature, tree-lined plots, diplomatic residences and the Muthaiga Country Club. It combines a private setting with being relatively close to the city centre.",
    character: [
      "Large, often older homes on generous plots",
      "Mature gardens and tree-lined roads",
      "Many ambassadors' and diplomatic residences",
      "Relatively close to the CBD, with links to Thika Road and Limuru Road",
    ],
    suits: [
      "Buyers looking for an established, prestigious address",
      "Diplomatic and senior executive households",
      "Buyers happy to renovate an older home",
    ],
    checks: [
      LAND_TITLE_CHECK,
      "Older titles deserve extra care: have a lawyer trace the history and check lease terms.",
      "Commission a structural survey, since many homes are decades old.",
      "Ask the residents' association about local rules and security arrangements.",
    ],
  },
];
