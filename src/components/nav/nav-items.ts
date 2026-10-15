export type NavKey = "home" | "tournaments" | "team" | "voyage" | "profile" | "admin";
export type NavItem = { key: NavKey; href: string };

export const MAIN_NAV: readonly NavItem[] = [
  { key: "home", href: "/" },
  { key: "tournaments", href: "/tournaments" },
  { key: "team", href: "/team" },
  { key: "voyage", href: "/voyage" },
  { key: "profile", href: "/profile" },
];

export function navItems(isPlatformAdmin: boolean): NavItem[] {
  return isPlatformAdmin ? [...MAIN_NAV, { key: "admin", href: "/admin" }] : [...MAIN_NAV];
}

export function isActive(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
