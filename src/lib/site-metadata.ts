import type { Metadata } from 'next';
import { siteConfig, siteUrl } from '../config/site';

/** 每个页面明确给出自己的地址，避免内页继承首页的 canonical / Open Graph。 */
export function pageMetadata(path: string, title?: string, description: string = siteConfig.description): Metadata {
  return {
    ...(title ? { title } : {}),
    description,
    alternates: { canonical: siteUrl(path) },
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      siteName: siteConfig.name,
      title: title ? `${title} · ${siteConfig.name}` : siteConfig.name,
      description,
      url: siteUrl(path),
    },
  };
}
