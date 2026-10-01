import Link from 'next/link';
import { DEFAULT_LANG, getDict } from '@/lib/i18n';
import { outbound } from '@/lib/outbound';
import { siteConfig } from '@/config/site';

/** 数据源署名。CC-BY 4.0 要求每个展示页都能找到出处，所以放在全站布局里而不是某一页。 */
const DATA_SOURCES = [
  { name: 'Epoch AI', license: 'CC-BY 4.0', href: 'https://epoch.ai/data/ai-benchmarking-dashboard' },
  { name: 'models.dev', license: 'MIT', href: 'https://models.dev' },
  { name: 'LiveBench', license: 'Apache-2.0', href: 'https://livebench.ai' },
  /*
   * 竞技场分来自 LMArena 官方发布的 `lmarena-ai/leaderboard-dataset`（CC-BY 4.0）。
   * 链接指向数据集本身而不是 arena.ai 的榜单页：CC-BY 要求给出**材料**的链接，
   * 而我们用的是那份数据集，不是那个网页。修改声明在致谢页。
   */
  {
    name: 'LMArena',
    license: 'CC-BY 4.0',
    href: 'https://huggingface.co/datasets/lmarena-ai/leaderboard-dataset',
  },
];

/** 角色是本站原创像素画，不在这一行；借用了哪些社区形象写在 /credits/。 */
const ART_SOURCES = [
  {
    name: 'Fusion Pixel Font',
    license: 'OFL-1.1',
    href: 'https://github.com/TakWolf/fusion-pixel-font',
  },
];

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!outbound(href)) return <span className="text-[var(--color-parchment)]">{children}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--color-parchment)] underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
    >
      {children}
    </a>
  );
}

/**
 * 全站页脚：数据与美术的出处。
 *
 * 这不是装饰。Epoch 与 LMArena 的 CC-BY 是「署名即可用」的许可，
 * 署名做在每一页的页脚是最稳妥的履约方式——读者截任何一页的图，出处都在。
 * 角色形象借用了哪些社区设定放在 /credits/ 单页，这里只给入口。
 */
export function SiteFooter() {
  const dict = getDict(DEFAULT_LANG);
  return (
    <footer className="relative mt-12 border-t border-white/10 bg-black/40">
      <div className="mx-auto max-w-6xl px-4 py-5 text-[12px] leading-relaxed text-[var(--color-ghost)] sm:px-8">
        <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-white/10 pb-4">
          <span className="text-[13px] font-semibold text-[var(--color-parchment)]">{siteConfig.labName}</span>
          {[siteConfig.links.home, siteConfig.links.modelHub].map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
              className="pixel-button px-2 py-1 text-[12px] leading-tight text-[var(--color-ink)] hover:bg-[var(--color-gold)]">
              {link.name}
            </a>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-1.5 gap-y-1">
          <span>{dict.footer.dataFrom}</span>
          {DATA_SOURCES.map((s, i) => (
            <span key={s.name}>
              <ExtLink href={s.href}>{s.name}</ExtLink>
              <span className="opacity-70">（{s.license}）</span>
              {i < DATA_SOURCES.length - 1 && <span className="mx-1 opacity-50">·</span>}
            </span>
          ))}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-1">
          <span>{dict.footer.artFrom}</span>
          {ART_SOURCES.map((s, i) => (
            <span key={s.name}>
              <ExtLink href={s.href}>{s.name}</ExtLink>
              <span className="opacity-70">（{s.license}）</span>
              {i < ART_SOURCES.length - 1 && <span className="mx-1 opacity-50">·</span>}
            </span>
          ))}
          <span className="mx-1 opacity-50">·</span>
          <Link
            href={siteConfig.links.credits.href}
            className="text-[var(--color-parchment)] underline decoration-dotted underline-offset-2 hover:text-[var(--color-gold)]"
          >
            {siteConfig.links.credits.name}
          </Link>
        </div>
        <div className="mt-2">
          <ExtLink href={siteConfig.links.upstream.href}>{siteConfig.links.upstream.name}</ExtLink>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {siteConfig.registrations.map((registration) => (
            <ExtLink key={registration.href} href={registration.href}>{registration.name}</ExtLink>
          ))}
        </div>
      </div>
    </footer>
  );
}
