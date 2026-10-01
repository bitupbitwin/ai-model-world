import Link from 'next/link';
import { SiteHeader } from '@/components/world/SiteHeader';
import { DEFAULT_LANG } from '@/lib/i18n';

export default function NotFound() {
  return (
    <main className="min-h-[65vh]">
      <SiteHeader current={null} lang={DEFAULT_LANG} />
      <div className="page-shell py-16">
        <h1 className="text-2xl text-[var(--color-parchment)]">404 · 页面不存在</h1>
        <p className="mt-4 text-sm text-[var(--color-ghost)]">这个地址还没有模型入住，请检查链接或返回首页。</p>
        <Link href="/" className="pixel-button mt-6 inline-block px-4 py-2 text-sm text-[var(--color-ink)]">返回首页</Link>
      </div>
    </main>
  );
}
