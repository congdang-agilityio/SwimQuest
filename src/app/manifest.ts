import type { MetadataRoute } from "next";

const NAVY = "#062B46";
const FOAM = "#F4FBFF";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SwimQuest",
    short_name: "SwimQuest",
    start_url: "/",
    display: "standalone",
    theme_color: NAVY,
    background_color: FOAM,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Wave mark inside the maskable safe zone, on the theme navy (G1 brand art).
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
