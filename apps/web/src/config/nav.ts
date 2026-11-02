export type NavItem = {
  label: string;
  href: string;
};

export type AreaItem = NavItem & {
  description: string;
};

export const primaryNav: NavItem[] = [
  { label: "Homes", href: "/homes" },
  { label: "Land", href: "/land" },
  { label: "Why join", href: "/join" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
  { label: "Sign in", href: "/account" },
];

export const areasNav: AreaItem[] = [
  { label: "Karen", href: "/communities/karen", description: "Gated estates & acreage" },
  { label: "Runda", href: "/communities/runda", description: "Diplomatic, leafy, private" },
  { label: "Kilimani", href: "/communities/kilimani", description: "Urban convenience, modern" },
  { label: "Rosslyn", href: "/communities/rosslyn", description: "Quiet, embassy-adjacent" },
  { label: "Lavington", href: "/communities/lavington", description: "Established, family homes" },
  { label: "Muthaiga", href: "/communities/muthaiga", description: "Old-money, tree-lined" },
];
