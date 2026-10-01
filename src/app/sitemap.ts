import type { MetadataRoute } from 'next';
import { publicRoutes, siteUrl } from '@/config/site';
import { loadSnapshot } from '@/lib/snapshot';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const snapshot = loadSnapshot();
  return [
    ...publicRoutes,
    ...snapshot.vendors.map((vendor) => `/vendor/${vendor.id}/`),
    ...snapshot.models.map((model) => `/model/${model.slug}/`),
  ].map((route) => ({ url: siteUrl(route), lastModified: snapshot.generatedAt }));
}
