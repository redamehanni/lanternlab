import type { MetadataRoute } from "next";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/recherche", "/carte", "/connexion"].map((path) => ({
    url: `${appUrl}${path}`,
    lastModified: new Date(),
  }));
}
