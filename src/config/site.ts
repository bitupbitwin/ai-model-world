/** OneNova 的品牌入口集中于此；数据来源与素材许可证继续由上游维护。 */
const configuredUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://models.onenovalab.com');
if (!['http:', 'https:'].includes(configuredUrl.protocol) || configuredUrl.username || configuredUrl.password ||
    configuredUrl.pathname !== '/' || configuredUrl.search || configuredUrl.hash) {
  throw new Error('NEXT_PUBLIC_SITE_URL 必须是无路径、参数和凭据的 HTTP(S) 站点地址');
}

export const siteConfig = {
  name: 'AI 模型世界 · OneNova Lab',
  labName: 'OneNova Lab',
  url: configuredUrl.origin,
  tagline: '一眼看懂大模型的当下格局',
  description: '把每个大模型画成一个像素角色，用能力条和排行榜把「谁最聪明、谁最会编程、谁最便宜」摆在明面上。数据来自第三方公开评测，每 12 小时自动同步。',
  links: {
    home: { name: '返回主站', href: 'https://onenovalab.com' },
    modelHub: {
      name: '官方订阅价与命令行支持',
      href: 'https://onenovalab.com/tools/ai-model-hub',
      hint: '前往 OneNova Lab 查看官方订阅价格与命令行支持信息',
    },
    upstream: {
      name: '基于程序员鱼皮的开源项目 ai-model-world（MIT 协议）',
      href: 'https://github.com/liyupi/ai-model-world',
    },
    credits: { name: '素材署名', href: '/credits/' },
  },
  registrations: [
    { name: '沪ICP备2026037572号-1', href: 'https://beian.miit.gov.cn/' },
    { name: '沪公网安备31011002008105号', href: 'https://beian.mps.gov.cn/#/query/webSearch?code=31011002008105' },
  ],
} as const;

/** 公开页面的固定路由；筛选参数共享所在页面的 canonical。 */
export const publicRoutes = ['/', '/chronicle/', '/leaderboard/', '/leaderboard/all/', '/compare/', '/credits/'] as const;

export function siteUrl(path = '/'): string {
  return new URL(path, `${siteConfig.url}/`).toString();
}
