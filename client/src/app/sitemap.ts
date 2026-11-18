import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { sitemapDevices } from "@/lib/shop-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const devices = await sitemapDevices();
  return [
    { url: siteUrl("/"), changeFrequency: "daily", priority: 1 },
    { url: siteUrl("/may"), changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl("/phu-kien"), changeFrequency: "weekly", priority: 0.5 },
    { url: siteUrl("/chinh-sach"), changeFrequency: "monthly", priority: 0.3 },
    ...devices.map((d) => ({ url: siteUrl(`/may/${d.slug}-${d.id}`), lastModified: d.updatedAt, priority: 0.8 })),
  ];
}
