export type NavKey = "home" | "tournaments" | "team" | "voyage" | "profile" | "admin";
export type NavItem = { key: NavKey; href: string };

/** The five main destinations, in display order. */
export const MAIN_NAV: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "tournaments", href: "/tournaments" },
  { key: "team", href: "/team" },
  { key: "voyage", href: "/voyage" },
  { key: "profile", href: "/profile" },
];

const ADMIN_ITEM: NavItem = { key: "admin", href: "/admin" };

/** Main destinations plus the "Admin" entry, shown only to platform admins. */
export function navItems(isPlatformAdmin: boolean): NavItem[] {
  return isPlatformAdmin ? [...MAIN_NAV, ADMIN_ITEM] : [...MAIN_NAV];
}

/** `/` matches only itself; other items also match their sub-pages. */
export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
