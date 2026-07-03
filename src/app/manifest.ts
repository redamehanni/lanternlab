import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ma Zone — Livré dans l'heure",
    short_name: "Ma Zone",
    description:
      "Trouvez un produit autour de vous et faites-vous livrer en moins d'une heure.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f2d5c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
