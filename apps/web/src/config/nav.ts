export type NavItem = {
  label: string;
  href: string;
  /** Set to true when the route ships, so the site never links to a 404. */
  live: boolean;
};

const navItems: NavItem[] = [
  { label: "Why join", href: "/join", live: true },
  { label: "Homes", href: "/homes", live: false },
  { label: "Land", href: "/land", live: false },
  { label: "About", href: "/about", live: false },
];

export const primaryNav = navItems.filter((item) => item.live);
