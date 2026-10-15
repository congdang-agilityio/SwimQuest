import type { Route } from "./index";

const slugs = [
  "non_nuoc",
  "son_thuy",
  "pham_van_dong",
  "man_thai",
  "hon_sup",
  "cu_lao_cham",
  "ly_son",
] as const;

export const route01: Route = {
  id: "route01",
  destinations: slugs.map((slug) => ({
    slug,
    nameKey: `routes.route01.${slug}`,
    isFinish: slug === "ly_son",
  })),
};
