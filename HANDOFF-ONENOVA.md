# OneNova 模型子站交接说明

> 第一至九节记录首轮提交 c1a4b18 的历史状态。第二轮的当前部署方式、依赖版本和验收数据以第十节「第二轮修订」为准，首轮全量明文上传方案已被替换。

验收完成日期：2026-10-02（北京时间）。所有工作在 Windows 本机的 `I:\ai-model-world` 完成，未读写另一个项目 `I:\onenovalab.com`。

## 一、当前状态与审核入口

- 分支：`onenova`，只做本地提交。上游基线：`88344b2886032121326d9e0f509f50529db69e1e`。
- 远程只有 `upstream`：`https://github.com/liyupi/ai-model-world.git`。没有创建 Fork、新仓库、Issue 或 PR，没有推送、触发工作流或上传 OSS。
- 目标站名：**AI 模型世界 · OneNova Lab**。目标网址：**https://models.onenovalab.com**。
- 品牌入口：`src/config/site.ts`。`NEXT_PUBLIC_SITE_URL` 可覆盖站点网址；只接受不带路径、参数、片段和凭据的 HTTP(S) 站点地址。canonical、Open Graph、sitemap、robots 共用此配置。备案、主站、工具页及代码署名也集中于此。
- 当前生产构建产物：`out/`。构建产物、下载工具、临时字体工具、浏览器截图和测试报告均由原有 `.gitignore` 排除，不提交。
- 请审核者 Claude 先查看本文件、`git diff upstream/main --stat` 与 `git diff upstream/main`。上线前仍需另行决定承载仓库、主分支和 OSS 配置；本次不执行上线。

## 二、改动文件及原因

以下列出所有改动过的当前上游文件，便于未来合并。没有修改数据快照、排名规则、同步解析器、README、AGENTS、CLAUDE、NOTICE 或 LICENSE。

| 上游文件 | 改动原因 |
| --- | --- |
| `.github/workflows/sync.yml` | 保持现有同步行为；锁定全部 Action SHA；说明成功后由 OSS 工作流接续；自动同步的提交说明改为中文。 |
| `.github/workflows/toy.yml` | 删除不需要的 B 站 Toy 自动发布。 |
| `next.config.ts` | 保留静态导出、`trailingSlash: true` 和图片不优化；默认生产产物固定为 `out/`，开发仍用 `.next/`，保留 `NEXT_DIST_DIR` 覆盖。 |
| `package.json` | 新增 `postbuild`，修正实测存在的 Windows 静态预取文件名问题；依赖版本与锁文件未变。 |
| `public/fonts/pixel-zh.woff2` | 用上游字体脚本重新生成中文子集，包含新品牌、备案与链接用字；字体许可不变。 |
| `scripts/bilibili/refresh.ts` | 去掉作者 MID 常量、写入和置顶参数；未来刷新同样纯按播放量排序。未实际调用 B 站刷新。 |
| `src/app/layout.tsx` | 站名、描述、标题模板及首页 SEO 从品牌配置读取。 |
| `src/app/chronicle/page.tsx` | 时间线自己的 canonical、Open Graph。 |
| `src/app/compare/page.tsx` | 对比页自己的 canonical、Open Graph。 |
| `src/app/credits/page.tsx` | 素材署名页自己的 canonical、Open Graph；原有署名内容完整保留。 |
| `src/app/leaderboard/page.tsx` | 排行榜自己的 canonical、Open Graph。 |
| `src/app/leaderboard/all/page.tsx` | 分类页自己的 canonical、Open Graph；筛选参数共用分类页地址。 |
| `src/app/model/[slug]/page.tsx` | 每个模型独立 SEO；停止传入作者置顶 MID。 |
| `src/app/vendor/[id]/page.tsx` | 每个厂商独立 SEO。 |
| `src/components/character/ReviewLinks.tsx` | 原个人评测文章推广替换为 OneNova 官方订阅价与命令行支持入口。 |
| `src/components/character/VideoList.tsx` | 删除站长标记和置顶说明，保留视频卡片、UP 主署名、封面、搜索入口等功能。 |
| `src/components/world/SiteFooter.tsx` | 替换个人推广；加入主站、工具页、备案和明确的上游 MIT 署名；保留数据、字体署名及 `/credits/`。 |
| `src/lib/i18n.ts` | 简体中文品牌及工具入口文案读取配置；其余上游字典保留。 |
| `src/lib/video-library.ts` | 默认空视频库不再包含作者 MID。 |
| `src/lib/videos.ts` | 选取和读取旧快照时均按播放量降序，同播放量按 BV 号稳定排序；兼容旧 `authorMid` 字段但不使用它，不修改原数组。 |

新增文件如下：

| 新文件 | 用途 |
| --- | --- |
| `src/config/site.ts` | 统一品牌、站点、链接、备案和公开固定路由。 |
| `src/lib/site-metadata.ts` | 统一页面 SEO 生成，避免内页继承首页地址。 |
| `src/app/sitemap.ts` | 静态站点地图，包含固定页面、625 个模型和 65 个厂商。 |
| `src/app/robots.ts` | 静态 robots，声明 sitemap，排除 QA 页面。 |
| `src/app/not-found.tsx` | 中文 404 页面及返回首页入口。 |
| `.github/workflows/deploy-oss.yml` | 审核后使用的 OSS 自动部署流程。 |
| `scripts/deploy/oss.mjs` | 校验配置、设置缓存、按站点清单执行上传与清理。 |
| `scripts/deploy/oss.test.mjs` | 6 项离线部署测试，全部使用本地替身，不连接 OSS。 |
| `scripts/export/normalize-segments.mjs` | Windows 导出后的预取文件名修正。 |
| `scripts/qa/verify-onenova.ts` | 全量页面、SEO、备案、署名、视频排序及体积自检。 |
| `scripts/qa/serve-static.py` | 本地目录首页服务，未知路径返回真实 `404.html` 与 HTTP 404。 |
| `scripts/qa/browser-onenova.ts` | 1440/390 两种宽度逐页浏览、交互及截图自检。 |
| `assets/lpc/CREDITS.md` | 从上游历史提交恢复的原始 LPC 署名文件。 |
| `HANDOFF-ONENOVA.md` | 本交接说明。 |

### Windows 导出兼容性补充

在本机实测发现 Next.js 16.3.3 导出的部分预取负载位于嵌套目录，例如 `chronicle/__next.chronicle/__PAGE__.txt`，但浏览器请求 `chronicle/__next.chronicle.__PAGE__.txt`，导致点击或预取时报 404。已核对安装包中的导出代码：它使用系统路径分隔符生成相对路径，编码阶段只替换 `/`。

新增 `postbuild` 只把这类 `.txt` 移到正确的扁平文件名，保持内容不变；重名必须内容一致，只删除已确认的重复文件和空目录，不修改依赖包。最终构建修正 697 个文件。Linux 正常输出时不需要修正。没有删除 RSC 负载或关闭链接预取。

## 三、去掉或替换的原作者个人内容

1. 页脚的“作者：程序员鱼皮”个人推广及 B 站主页 `https://space.bilibili.com/12890453` 已移除；法定许可和代码署名仍保留。
2. 页脚的个人像素小鱼徽记已移除，改为 OneNova Lab 品牌文字。
3. “AI 编程入门教程 / 零基础学 Vibe Coding”及 `https://ai.codefather.cn/vibe` 已移除。
4. “鱼皮 AI 导航 / AI 工具、资讯与提示词大全”及 `https://ai.codefather.cn` 已移除。
5. “编程导航 / 程序员一站式编程学习交流社区”及 `https://www.codefather.cn` 已移除。
6. 模型卡片与详情页的个人“评测文章 / 模型动态”入口改为“官方订阅价与命令行支持”，链接 `https://onenovalab.com/tools/ai-model-hub`。
7. 视频置顶来自两处：`pickVideos` 原先优先作者 MID，`VideoList` 原先显示“站长”标记。两处已删除，同时在 `videosFor` 对旧快照重新排序，避免旧数据仍按置顶顺序展示。刷新脚本不再维护作者 MID。上游快照中的旧字段保留以减少数据差异，字段已失效。作者视频若播放量足够高仍可正常入选。
8. `.github/workflows/toy.yml` 已删除。`scripts/toy/`、相关 npm 命令、上游 Toy 文档保留以减少合并冲突；本站没有 Toy 发布入口或自动发布工作流，本次没有调用它们。

未发现需要另行删除的在用公众号推广组件。上游 README、历史记录、许可署名、评测视频的 UP 主来源信息均保留，不把来源署名当作广告删除。

## 四、许可与数据边界

- `LICENSE`、`NOTICE.md`、`assets/fonts/OFL.txt` 和字体的各项原始许可证未改动。
- 当前上游已经改用手绘 chibi 精灵，基线中并不存在 `assets/lpc/CREDITS.md`，但 `NOTICE.md` 仍提及它。为满足本次明确的署名保留要求，从上游历史提交 `f7fbe75` 恢复了该文件的原始字节，没有重新引入 LPC 图片或角色生成方案。
- `/credits/` 内容完整保留，页脚继续显示 Epoch AI（CC-BY 4.0）、models.dev（MIT）、LiveBench（Apache-2.0）、现有 LMArena 官方数据集（CC-BY 4.0）以及字体 OFL 署名。
- 未新增数据源，未抓取 Artificial Analysis 或 LMArena 网站，未执行数据同步。上游的 AA 拦截、禁止直接抓取 Arena 网站和忽略原始响应缓存的规则未变。
- 注意上游当前文档的细节：`docs/DATA.md` 第二节已允许读取权利人在 Hugging Face 发布的 LMArena CC-BY 4.0 数据集，并保留 Epoch 转发的 WebDev Arena 分数；这不同于直接抓取其网站。它们在本次克隆基线中已存在。本次只保留既有来源与署名，没有扩大使用范围。若 OneNova 要求完全排除所有 Arena 来源，需要审核者明确该额外范围，再同步修改解析器、现有快照和署名说明。

## 五、部署工作流及四个 Secrets

### 触发与构建

`deploy-oss.yml` 支持以下三种触发：

1. `main` 上的代码推送。
2. `workflow_dispatch` 手动运行，只允许 `main`。
3. `workflow_run` 监听名为“同步模型数据”的 `sync.yml` 成功完成，只允许本仓库 `main`。失败的同步、其他分支和外部仓库不部署。

`sync.yml` 用 `GITHUB_TOKEN` 推送的快照提交不会产生新的 `push` 工作流，所以必须保留第三种触发。接续部署重新检出最新 `main`，不会使用同步开始前的 `workflow_run.head_sha`。同步成功但没有数据变化时也会部署一次。

先检查 Secrets；缺少任何一个时只打印缺少的名字，并以成功状态跳过后续步骤。配置齐全时执行：`npm ci` → `npm run lint` → 离线部署测试 → `npm run build`（自动生成精灵、搜索索引并修正 Windows 路径）→ 全量产物自检 → 校验官方 ossutil → 上传。并发部署共用锁，上传过程中不取消。

工作流的 GitHub 权限只有 `contents: read`，检出时不持久保存 Git 凭据。上游同步仍需原有 `contents: write`、`issues: write`，因为它会提交数据并在失败时记录 Issue；本次没有运行这些动作。

### Secrets

审核后，在承载仓库的“Settings → Secrets and variables → Actions → Repository secrets”配置：

| Secret 名 | 内容 |
| --- | --- |
| `OSS_ACCESS_KEY_ID` | 仅可访问本站专用 Bucket 的 RAM 身份 AccessKey ID。 |
| `OSS_ACCESS_KEY_SECRET` | 对应的 AccessKey Secret。 |
| `OSS_BUCKET` | 本站专用 Bucket 名，仅名字，不能含 `oss://`、路径或通配符。 |
| `OSS_ENDPOINT` | 公网地域地址，例如 `oss-cn-shanghai.aliyuncs.com`；也接受相同地址的 `https://` 形式。 |

代码里没有真实密钥或凭据文件，只引用上述 Secrets 名字。`OSS_REGION` 由 endpoint 自动推导，不需要第五个 Secret。RAM 访问范围应限定到本站 Bucket 及其对象，允许读取清单、上传和删除本站对象，不授予删除 Bucket 或访问主站 Bucket 的权限。

### 官方 ossutil 与 Action 固定版本

使用阿里云官方 **ossutil 2.4.0**：

- 下载：`https://gosspublic.alicdn.com/ossutil/v2/2.4.0/ossutil-2.4.0-linux-amd64.zip`
- SHA-256：`85edf66b2fb7238f5c7e25cab820cf29312319fe4935b7c86a6b8485eb434f3c`
- 官方说明：[ossutil 工具介绍](https://help.aliyun.com/zh/oss/developer-reference/ossutil-overview/)。本地实际下载并核对了上述校验值，也查看了同版本 Windows 工具的 `cp`、`cat`、`rm` 帮助；没有使用凭据连接 OSS。

两个保留的工作流中，全部第三方 Action 均锁定真实 commit SHA。2026-10-01 通过只读命令 `gh api repos/<owner>/<repo>/git/ref/tags/<tag>` 取得，返回对象类型均为 `commit`：

| Action | 标签 | 已核验 commit SHA |
| --- | --- | --- |
| `actions/checkout` | `v7` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `v7` | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/cache` | `v6` | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` |
| `actions/upload-artifact` | `v7` | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` |
| `actions/github-script` | `v7` | `f28e40c7f34bde8b3046d885e986cb6290c5673b` |

### 缓存与清理顺序

1. 校验 `out/` 完整性、Bucket 名及对象路径；读取 `_onenova/models-deploy-manifest.json`。历史清单必须匹配本站 owner、版本和 Bucket，路径不得越界。
2. **先上传 `_next/static/**`**，设置 `Cache-Control: public, max-age=31536000, immutable`。
3. **再上传其余全部文件**，设置 `Cache-Control: no-cache, max-age=0, must-revalidate`。HTML、`data/` JSON、sitemap、robots、搜索索引和 RSC `.txt` 都会重新验证，不沿用长期旧缓存。
4. 两轮上传全部成功后，才逐个删除上一份本站清单记载、此次已经不存在的非哈希对象。没有 `sync --delete`、递归删除或全 Bucket 清理。首次部署没有清单时不删除任何已有对象；403、坏 JSON、错误归属等情况失败关闭。
5. 旧 `_next/static/` 哈希文件保留，避免仍打开旧页面的用户遇到 chunk 404；最后更新本站清单。历史哈希可能累积，后续由审核者决定保留周期及单独清理方案。

部署要求使用**本站独占的 Bucket**，不要填写主站 Bucket。清理依靠本站清单限定对象，不能自动判断一个 Bucket 是否还被其他站点共用。即使满足先上传后删除，多对象上传也不构成跨文件原子发布；本次未验证云端切换或传输性能。

## 六、OSS Bucket 设置

审核后在阿里云控制台准备独立 Bucket：

- 静态网站托管：默认首页 `index.html`。
- **开启子目录首页**；存在目录但缺少末尾斜线时采用读取目录首页的方式，避免把公开地址改成 `.../index.html`。
- 默认错误页 `404.html`，错误响应状态码设为 **404**。
- 网站对象需可公开读取，写入只授予部署用 RAM 身份；如组织使用其他公开访问架构，请同时确认自定义域名能读取站点全部对象。
- 绑定 `models.onenovalab.com`，按 OSS 控制台提示设置 DNS CNAME；配置该域名的 HTTPS 证书和对应访问入口。未在本次操作域名、DNS、证书或 Bucket。
- 保留上传时的对象 `Cache-Control`；如果前面接 CDN，不要覆盖 HTML、JSON、sitemap 和 `.txt` 为长缓存。数据同步上线后应可立即重新验证。
- HTML 应为 `text/html`；JSON 为 `application/json`；`.txt` 为文本响应。静态网站默认域名可能对 HTML 使用下载行为，请用绑定的目标自定义域名验收。

参考阿里云官方 [静态网站配置 API](https://help.aliyun.com/zh/oss/developer-reference/putbucketwebsite)。`trailingSlash: true` 已保留；全量检查确认 696 个公开路由均有 `<路径>/index.html`，另有上游 QA 的 `qa/crests/index.html` 和根级 `404.html`。QA 页面保留 `noindex`，不列入 sitemap。

## 七、本地验收与构建统计

环境：Windows / PowerShell，Node.js 22.22.3、npm 10.9.8、Python 3.11.9；上游 Next.js 16.3.3、React 19.2.8。

| 验收项 | 结果 |
| --- | --- |
| `npm ci` | 通过；未改动 `package-lock.json`，安全告警见最后一节。 |
| `npm run lint` | 通过。 |
| `npm run build` | 通过；625 个精灵、搜索索引和静态页面全部生成，TypeScript 编译通过。 |
| `npx tsx scripts/sync/selftest.ts` | 224 项通过、0 项失败；其中有预期的负面用例日志。 |
| `node --test scripts/deploy/oss.test.mjs` | 6 项通过、0 项失败；检查缺少 Secrets、上传顺序、缓存、清理范围和失败时不删除。 |
| `npx tsx scripts/qa/verify-onenova.ts` | 696 个公开路由、所有 canonical/OG/sitemap、备案、署名和旧视频快照无置顶检查通过。 |
| 环境变量覆盖 | 用临时 `NEXT_PUBLIC_SITE_URL=https://preview.example.com` 验证配置和 SEO 地址覆盖通过；最终构建使用目标生产网址。 |
| 工作流静态检查 | YAML、触发条件、权限、Action SHA 格式和 Bash 语法检查通过；未在 GitHub 实际运行。 |
| 当前完整产物模拟部署 | 使用本地命令替身完成 4,845 文件的上传/清单模拟，首次部署删除 0 项；没有执行 ossutil 上传。 |
| 差异检查 | 除恢复的历史 `assets/lpc/CREDITS.md` 原有末尾空行提示外，其他文件的 `git diff --check` 通过；恢复文件与历史 blob 字节一致。`git diff upstream/main --stat` 仅包含本文件列明的预期修改。 |

### 产物统计

`out/` 共 **4,845 个文件，654,159,919 字节，约 623.86 MiB（654.16 MB）**。这是未经网络压缩的文件总大小，包含 Next 静态页面与 RSC 负载，不是 Git 提交大小。625 个模型、65 个厂商、6 个固定公开页面，共 696 个公开路由。

最大的 10 个文件：

| 排名 | 相对 `out/` 的路径 | 字节数 |
| --- | --- | ---: |
| 1 | `chronicle/index.html` | 6,631,952 |
| 2 | `chronicle/index.txt` | 3,206,720 |
| 3 | `chronicle/__next._full.txt` | 3,206,720 |
| 4 | `chronicle/__next.chronicle.__PAGE__.txt` | 3,120,234 |
| 5 | `index.html` | 3,116,425 |
| 6 | `index.txt` | 1,573,133 |
| 7 | `__next._full.txt` | 1,573,133 |
| 8 | `vendor/openai/index.html` | 1,568,565 |
| 9 | `__next.__PAGE__.txt` | 1,494,832 |
| 10 | `vendor/alibaba/index.html` | 1,493,810 |

### 逐页浏览结果

使用本地目录首页服务器 `scripts/qa/serve-static.py`，绑定 `127.0.0.1:4321`。使用独立临时 Chrome 进行 Playwright 验收，不读取用户浏览器资料。1440×900 和 390×900 各完成以下 9 项，共 18 项：

| 页面或交互 | 验收地址 | 两种宽度结果 |
| --- | --- | --- |
| 首页 | `/` | HTTP 200，正常渲染。 |
| 文本模型分类 | `/leaderboard/all/?kind=text` | HTTP 200，文本筛选选中。 |
| 深度求索厂商 | `/vendor/deepseek/` | HTTP 200。 |
| 模型详情 | `/model/deepseek-deepseek-v3-2/` | HTTP 200；4 张视频封面均加载成功；视频顺序与播放量降序一致，无站长标记或置顶说明。 |
| 时间线 | `/chronicle/` | HTTP 200。 |
| 排行榜 | `/leaderboard/` | HTTP 200；点击“国内”后筛选正常。 |
| 素材署名 | `/credits/` | HTTP 200，原署名内容保留。 |
| 不存在的路径 | `/onenova-qa-missing/` | HTTP 404，显示“404 · 页面不存在”和返回首页入口。 |
| 搜索“多模态” | 首页输入后点击搜索结果 | 能找到类别并跳到 `?kind=multimodal`，多模态筛选选中。 |

所有逐页检查均核对页脚的主站、工具页、上游署名、素材署名、ICP 和公安备案文字及目标地址。没有页面脚本异常、非预期控制台错误或实际资源加载失败；没有页面整体横向溢出。已目视核对宽屏和手机截图。

不存在路径的 HTTP 404 在浏览器控制台会产生一条预期资源状态提示，单独记载，不作为脚本异常。Next.js 静态预取会主动取消部分 HEAD 探测，记录为 `net::ERR_ABORTED`，也单独列出；实际 GET 资源没有失败。搜索和分类跳转已验证。

证据保存在本机 `.next-qa/browser-results.json` 和 `.next-qa/*.png`，按仓库惯例忽略不提交；审核者可运行下面命令重新生成：

```powershell
# 终端一，仓库根目录：
npm ci
npm run lint
npm run build
npx tsx scripts/qa/verify-onenova.ts
python scripts/qa/serve-static.py

# 终端二，仓库根目录：
npx tsx scripts/qa/browser-onenova.ts
node --test scripts/deploy/oss.test.mjs
```

浏览器脚本默认使用 `C:/Program Files/Google/Chrome/Application/chrome.exe`；路径不同可设置 `ONENOVA_QA_BROWSER`。不应直接运行 `scripts/deploy/oss.mjs` 做本地 UI 验收；有真实环境凭据时它会连接 OSS。

## 八、以后同步上游

先确认没有未提交改动，并建立本地备份分支，再合并：

```powershell
git switch onenova
git status --short
git branch codex/onenova-合并前备份-20261002
git fetch upstream
git merge upstream/main
```

备份名中的日期每次改为实际日期。`fetch` 与本地 `merge` 不会推送。冲突解决后重新安装、lint、build，运行上面的全量路由、视频排序、部署离线测试和双宽度浏览验收，完成中文本地提交；审核通过后再决定推送。

可能冲突的位置：

- `SiteFooter.tsx`、`i18n.ts`、`ReviewLinks.tsx`：保留 `siteConfig` 接入和 OneNova 链接，同时接收上游新的合规署名、文案和组件变化；不要恢复作者个人推广。
- `VideoList.tsx`、`videos.ts`、`video-library.ts`、`scripts/bilibili/refresh.ts` 和模型详情页：保留无作者优先的播放量排序，接收上游筛选、风险拦截及数据结构更新；旧 `authorMid` 只能作兼容字段。
- 布局及各页面的 metadata：保留每个页面的地址，不能让内页退回首页 canonical；新上游路由应加入本地全量路由验收和 sitemap。
- `next.config.ts`、`package.json`：保留 `out/` 默认产物和 `postbuild`。升级 Next 后先复验 Windows 文件名；确认新版本自行修复后再决定删除兼容脚本。
- `.github/workflows/sync.yml`：同步工作流名称必须与 `workflow_run.workflows` 一致；保留失败不部署、检出最新 `main` 和固定 Action SHA。上游若改变同步权限或失败处理，按实际功能审核。
- `.github/workflows/toy.yml`：若上游后来修改它而产生删除/修改冲突，本站继续删除该工作流；保留脚本不会自动发布。
- `public/fonts/pixel-zh.woff2`：中文 UI 改字后按上游 `npm run font` 重新生成子集再验收，保留所有字体许可证。不要凭冲突一方直接覆盖而丢失备案用字。
- 恢复的 `assets/lpc/CREDITS.md`：保留历史署名；如果上游重新整理 NOTICE 和素材目录，由审核者统一检查归属，不自行删掉许可信息。

一般无需更改新增的 `src/config/site.ts`；新品牌信息应继续集中于它。不要为解决冲突引入 AA 数据、直接 Arena 抓取或提交 `data/.cache/`。正常数据自动更新仍由上游同步脚本负责，不手改排名或编造指标。

## 九、仍需审核者决定

1. **依赖安全更新。** 最后一次 `npm ci` 的审计报告仍有 2 项告警：Next.js 16.3.3 的 `next/og` ImageResponse 相关严重漏洞 `GHSA-vcvr-r3jv-pc5j`，以及开发依赖 `brace-expansion` 的高危告警。它们来自当前上游锁文件，本次未升级依赖。本站输出纯静态文件，没有引入 Next 服务器或 `next/og` 调用，但建议上线前由 Claude 审核升级到已修复版本并重跑完整验收。官方 [Next.js 发布说明](https://nextjs.org/blog) 已列出 2026-09-30 的 16.3.8 安全版本。
2. **Arena 来源范围。** 是否接受上游已经声明允许的官方 CC-BY 4.0 数据集及 Epoch 再分发。如果要求完全排除，需另作明确的数据范围改造。本次没有引入新来源，也没有弱化拦截规则。
3. **承载仓库与上线配置。** 审核后确定新远程、如何把已审核分支放入 `main`、四个 Secrets、本站独占 Bucket、静态托管、域名、HTTPS 与 DNS；当前没有云端部署验证，不能把本地通过等同于 OSS 线上通过。
4. **产物体积与哈希保留。** 约 624 MiB 的静态输出主要来自上游页面和 RSC 数据；上线后可按访问情况决定压缩/CDN和页面体积优化。部署为避免旧页面 404 会保留历史哈希资源，需要另定可接受的保留周期。
5. **命名。** 当前严格使用要求的“AI 模型世界 · OneNova Lab”。若希望导航更短，可考虑“模型世界 · OneNova”，但本次没有擅自更名。

上述待决定项不影响本次本地改造、构建与提交的可审阅性；任何推送、工作流运行和 OSS 上传都留待审核之后。

## 十、第二轮修订

日期：2026-10-02。修改范围仅限 `I:\ai-model-world`；在 `onenova` 上新增本地提交，保留 `c1a4b18`，不改写历史。没有推送、运行 GitHub 工作流、连接 OSS 或操作主站项目。

### 1. 改动文件

| 文件 | 本轮改动 |
| --- | --- |
| `scripts/deploy/prepare.mjs`（新增） | 确定性 gzip、MIME 类型、上传字节 sha256、v1/v2 清单校验、分组增量计划。 |
| `scripts/deploy/oss.mjs` | 上传改为按 v2 指纹增量分组；加入无凭据 `--plan`；控制清单也 gzip，兼容读取旧明文与新 gzip 字节。 |
| `scripts/deploy/oss.test.mjs` | 扩展为 15 项完全离线测试。 |
| `.github/workflows/deploy-oss.yml` | `timeout-minutes` 从 30 改为 60；三种触发、最小权限、固定 Action SHA 与四个 Secrets 保持原审核方案。 |
| `package.json`、`package-lock.json` | 只升级 `next` 和配套 `eslint-config-next` 到 16.3.8；锁文件同时更新它们依赖的 `@next/*` 包。React、ESLint 等其他直接依赖版本未变。 |
| `scripts/export/build-id.ts`（新增）、`next.config.ts` | 用实际构建输入生成稳定 build id，避免 Next 默认随机 ID 使重复构建的 HTML/RSC 全部改变。 |
| `scripts/qa/serve-static.py` | 加入 gzip 模拟模式，原名对象返回预压缩字节及清单声明的响应头，目录首页和 404 行为保留。 |
| `scripts/qa/browser-onenova.ts` | 支持指定本地验收网址及 gzip 模式；核对 HTML、RSC、脚本、样式的 gzip 头和二进制无压缩头。 |
| `eslint.config.mjs` | 忽略 `.next-*/**`，与现有 `.gitignore` 保持一致，避免把预压缩 `.js` 和本地生成工具当成源码。 |
| `HANDOFF-ONENOVA.md` | 标明首轮记录范围，新增本节及实测数据。 |

品牌、备案、上游代码署名、数据/字体许可和去个人化方案均未再改动。模型数据、视频快照、排名与合规闸门未变。Next 16.3.8 的本机导出仍需要原有 Windows 预取文件名兼容脚本，最终构建修正 697 个路径，因此继续保留。

### 2. 预压缩、响应头与 v2 清单

已在本机实际执行官方 ossutil 2.4.0 的 `cp --help`，核实参数为 `--content-encoding`、`--content-type`、`--cache-control` 和 `--recursive`（别名 `-r`）。帮助说明也确认本地目录上传按相对目录结构形成对象键。没有运行任何连接 OSS 的命令。

- `.html .txt .json .js .css .xml .svg .webmanifest .map` 等文本使用 Node gzip level 9。gzip 头不含文件名，MTIME 固定为 0，OS 头固定为 255；文件 mtime 和暂存路径不参与字节输出。同一内容两次压缩及修改 mtime 后的字节一致性均通过测试。
- 图片、字体等二进制保持原字节。`out/` 仍是可直接本地访问的未压缩构建产物，预压缩文件只放在新的 `.next-*` 目录。
- 对象键保持原名，不加 `.gz`。文本上传时明确设置 `Content-Encoding: gzip`。HTML 为 `text/html; charset=utf-8`，RSC `.txt` 为 `text/plain; charset=utf-8`，JSON 为 `application/json; charset=utf-8`，其他类型按代码中的 MIME 表设置；二进制不设置 gzip 编码。
- v2 清单的 `files` 是对象键到元信息的映射，逐个记录 `sha256`、`contentEncoding`、`contentType`、`cacheControl`。sha256 对应实际上传字节，任一指纹或响应头变化都会触发上传。没有清单或只有 v1 文件列表时，全部当前文件需要上传。
- 本地计划保存可读的明文 JSON 清单；远端 `_onenova/models-deploy-manifest.json` 自身也是 gzip JSON，设置相同的短缓存，但以 `Content-Type: application/gzip` 存放、**不加 Content-Encoding**：带 Content-Encoding 时 ossutil 下载会自动解压并因 CRC 不一致失败，`ossutil cat` 还会在 stdout 混入耗时统计（2026-10-02 两次部署因此失败）。读取改用 `ossutil cp` 下载到临时文件，按 gzip magic 解码，兼容旧明文 v1/v2 清单；遇到旧格式清单的 CRC 错误时经 Bucket 公开地址用 curl 原样读取一次并以新格式重写；本地旧清单也接受两种形式和 UTF-8 BOM。控制清单不嵌入自己的对象表，避免 sha256 自引用。
- 上传顺序为哈希资源 → RSC、JSON 及其他资源 → HTML。按阶段与相同的响应头组合分组，只有需要上传的文件才复制到各组暂存目录，保持相对路径，每组只调用一次 `cp --recursive --force`。无变化时不上传文件，也不更新控制清单。
- 所有组上传成功后才清理旧文件。只删除上次本站清单记录、此次不存在的非哈希对象；历史哈希资源仍保留。v1 没有元信息的历史哈希只保留远端对象，不伪造它们的 sha256；v2 已知的历史哈希元信息继续保留。
- 精灵文件按模型 ID 命名，名字中的八位发布日期不是内容哈希，使用短缓存。HTML、RSC、数据 JSON 和 sitemap 也保持短缓存；它们不会仅因文件名像哈希而被设成长缓存。

Bucket 名、站点 owner、清单版本、对象路径等安全校验与首次不删除清单外对象的边界保留。缺少四个 Secrets 中任意一个时仍成功跳过。`cp --help` 列出 `oss:ListObjects`、`oss:GetObject`、`oss:PutObject` 权限，清理另需 `oss:DeleteObject`；都应限定在本站独占 Bucket，不授予删除 Bucket 或访问主站 Bucket 的权限。本次没有配置这些云端权限。

### 3. 两次 --plan 的最终实测结果

以下结果来自最终实现。先执行无旧清单的计划，再完整运行一次 `npm run build`（包含精灵和搜索索引重生成、静态导出与 postbuild），最后以第一份清单重新执行计划。两次均不读取凭据、不调用 ossutil、不连接 OSS。

```powershell
# 第一次：首次部署；--prepared-dir 指定的目录必须尚不存在。
node scripts/deploy/oss.mjs --plan --manifest-out .next-qa/oss-manifest-first-final.json --report-out .next-qa/oss-plan-first-final.json --prepared-dir .next-oss-preview-first-final

# 完整重建，然后第二次：
npm run build
npx tsx scripts/qa/verify-onenova.ts
node scripts/deploy/oss.mjs --plan --previous-manifest .next-qa/oss-manifest-first-final.json --manifest-out .next-qa/oss-manifest-second-final.json --report-out .next-qa/oss-plan-second-final.json --prepared-dir .next-oss-preview-second-final
```

重新验收时，若上述预压缩目录已存在，请使用新的 `.next-*` 名称，或省略 `--prepared-dir` 让脚本用临时目录并自动清理。计划清单中的 Bucket 使用 `OSS_BUCKET` 名字占位，不需要凭据。可以只运行 `node scripts/deploy/oss.mjs --plan`，默认新清单输出到 `.next-qa/oss-plan-manifest.json`。

| 指标 | ① 无旧清单 | ② 完整重建后读取①的 v2 清单 |
| --- | ---: | ---: |
| 当前站点文件数 | 4,845 | 4,845 |
| 全站原始字节数 | 654,185,221（623.88 MiB） | 654,185,221 |
| 全站上传版本字节数 | 113,369,238（108.12 MiB） | 113,369,238 |
| 待上传站点文件数 | 4,845 | **0** |
| 待上传文件压缩前字节数 | 654,185,221 | **0** |
| 待上传文件字节数 | 113,369,238 | **0** |
| 待清理对象数 | 0 | **0** |
| 需要更新控制清单 | 是 | 否 |
| 控制清单原始 / gzip 字节数 | 1,392,687 / 138,454 | 相同，但不上传 |
| 预计总上传字节数（含清单） | **113,507,692（108.25 MiB）** | **0** |

首次文件上传分为 11 组，再最后上传一次控制清单，共 12 次 `cp` 调用；不是 4,845 次进程启动。读取远端清单的 `cat` 不算上传。第二次只需读取清单，所有分组均为 0 个文件、0 字节，清单也不重传。

各组的最终结果如下。长缓存指 `public, max-age=31536000, immutable`；短缓存指 `no-cache, max-age=0, must-revalidate`。文本 Content-Type 均带 `charset=utf-8`。

| 阶段 | 类型 | 编码 / 缓存 | ① 文件数 | ① 原始字节 | ① 上传字节 | ② 文件数 / 上传字节 |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 哈希资源 | image/x-icon | 无 / 长 | 1 | 25,931 | 25,931 | 0 / 0 |
| 哈希资源 | application/javascript | gzip / 长 | 16 | 751,287 | 240,419 | 0 / 0 |
| 哈希资源 | text/css | gzip / 长 | 1 | 37,097 | 8,046 | 0 / 0 |
| 数据与其他资源 | font/woff2 | 无 / 短 | 1 | 49,272 | 49,272 | 0 / 0 |
| 数据与其他资源 | image/png | 无 / 短 | 625 | 8,461,434 | 8,461,434 | 0 / 0 |
| 数据与其他资源 | image/x-icon | 无 / 短 | 1 | 25,931 | 25,931 | 0 / 0 |
| 数据与其他资源 | application/json | gzip / 短 | 3 | 1,131,673 | 112,269 | 0 / 0 |
| 数据与其他资源 | application/xml | gzip / 短 | 1 | 89,746 | 4,436 | 0 / 0 |
| 数据与其他资源 | image/svg+xml | gzip / 短 | 5 | 3,314 | 1,859 | 0 / 0 |
| 数据与其他资源 | text/plain | gzip / 短 | 3,491 | 408,435,086 | 68,564,353 | 0 / 0 |
| HTML | text/html | gzip / 短 | 700 | 235,174,450 | 35,875,288 | 0 / 0 |

关键页面的上传字节：

| 对象 | 原始字节 | gzip 字节 |
| --- | ---: | ---: |
| `index.html` | 3,116,406 | 181,632（177.38 KiB） |
| `chronicle/index.html` | 6,631,933 | 283,843（277.19 KiB） |
| `model/deepseek-deepseek-v3-2/index.html` | 408,972 | 62,199（60.74 KiB） |

原始与 gzip 字节均来自本机实际文件。以上网络量是对象正文，不包含 HTTP 请求头、重试等开销，不是跨境耗时保证。

### 4. 重建稳定性的结论与建议

第二次没有接近全量，最终结果为 **零上传**。核对 Next 安装包 `dist/build/index.js` 确认其默认 ID 使用 `nanoid`，该随机 ID会进入 HTML、RSC 和静态构建目录。这会让相同源代码和快照重建后仍产生大量字节差异。

已按 Next 官方 `generateBuildId` 接口改成实际输入的内容哈希。输入包括 `src/`、`public/`（生成精灵和搜索索引）、两份运行时数据快照、Next/TypeScript/PostCSS 配置、依赖及锁文件、ID 脚本自身、站点网址/基础路径和 Node 版本/平台/架构；不依赖 Git 提交号、文件 mtime、当前时间或无关的同步报告和交接文档。最终两次构建均为 `onenova-a84dd4a4ae552b029abc5277`。

这个结果说明同一平台、工具版本、配置、代码与数据重复构建不会浪费上传量，不能据此承诺真实数据更新只改变少数页面。快照内容变化会改变构建 ID，共享的数据、导航和排行榜还可能使多份 HTML/RSC 一起变化；这些实际变化仍需要上传，上传的是压缩字节。将来如果引入新的运行时数据文件或影响输出的构建配置，应把它加入 ID 输入。跨 Windows/Linux 或 Node 版本变化时也不保证零差异。

后续若实际同步仍更新大多数 RSC，可再评估上游页面共享数据的拆分和构建身份粒度，不用固定常量 ID 或单纯忽略时间戳掩盖真实内容变化。本轮没有改变排名、日期显示或页面数据合同。

### 5. Next 升级与 npm audit

先执行 `npm view next versions --json`，过滤稳定 `16.3.x`，2026-10-02 取得的最高补丁为 **16.3.8**。官方 [GHSA-vcvr-r3jv-pc5j 公告](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j)列出受影响范围 `>=16.2.0 <16.3.6`、修复版本 16.3.6；[Next 官方发布页](https://nextjs.org/blog)确认 2026-09-30 的 16.3.8 安全版本。已把 `next`、`eslint-config-next` 精确升级至 **16.3.8**，没有使用 canary。

升级并重新 `npm ci` 后：

- `npm audit`：**共 1 项 high，critical 0，moderate 0，low 0**。Next 严重告警已消除。
- 剩余包为开发依赖链中的 `brace-expansion`，本机两处版本是 **1.1.18 / 5.0.9**，分别经 ESLint 的 minimatch 与 TypeScript ESLint 的 minimatch 引入。报告涉及 `GHSA-q2hr-2g5m-vwhr`、`GHSA-qhr7-859c-m2p7`、`GHSA-6j4f-fj2g-mc7p`。未执行 `npm audit fix` 或扩大依赖升级范围，留给审核者另行处理。
- `npm audit --omit=dev`：**0 项告警**。
- npm 另提示上游锁定的 ESLint 9.39.5 已停止支持；它不是新增的 audit 项，本轮按要求不升级该直接依赖。

原始审计结果保存在本机 `.next-qa/audit-round2.json` 和 `.next-qa/audit-production-round2.json`，版本查询在 `.next-qa/next-versions-round2.json`，均忽略不提交。

### 6. 本轮验收

`npm ci`、`npm run lint`、`npm run build`、`npx tsx scripts/qa/verify-onenova.ts`、`node --test scripts/deploy/oss.test.mjs` 全部通过。页面全量检查仍为 696 个公开路由；部署测试 **15 项通过、0 项失败**，覆盖 gzip 确定性、mtime 无关、文本/二进制、正确响应头、零变化/单文件变化/仅响应头变化、v1 迁移、上传顺序、清理范围、失败不删除、缺少 Secrets、无环境的计划 CLI，以及 gzip/明文清单解码。

本地 gzip 验收服务实际按原名返回预压缩正文和 `Content-Encoding: gzip`，Chrome 自动解码，并未在服务端解压：

```powershell
python scripts/qa/serve-static.py --port 4322 --gzip-dir .next-oss-preview-first-final --manifest .next-qa/oss-manifest-first-final.json

# 另一个终端：
$env:ONENOVA_QA_URL = 'http://127.0.0.1:4322'
$env:ONENOVA_QA_GZIP = '1'
npx tsx scripts/qa/browser-onenova.ts
```

1440×900 与 390×900 各 9 项，共 **18 项通过**。首页、时间线、模型页均正常渲染；文本分类、厂商、排行榜、搜索“多模态”、署名和真实 404 也通过。检查 HTML gzip/Content-Type、RSC `.txt` 类型、脚本样式编码，以及 PNG/字体没有 gzip 头；无页面脚本异常、非预期控制台错误或实际资源请求失败。404 的预期状态提示与 Next 主动取消的 HEAD 探测仍单独记录，不当成脚本错误。

浏览证据在 `.next-qa/gzip-browser/browser-results.json` 及同目录截图，两次最终计划在 `.next-qa/oss-plan-first-final.json`、`.next-qa/oss-plan-second-final.json`，可读清单在对应 `oss-manifest-*-final.json`，预压缩对象在对应 `.next-oss-preview-*-final/`。这些再生产物全部留本地、忽略不提交。部署时的暂存目录经过绝对路径范围校验后才清理，不覆盖现有目录，也不修改原始 `out/`。

当前首次部署应按 **约 108.25 MiB（含 gzip 控制清单）**规划。真实 OSS 接入、GitHub runner 跨境吞吐、错误页/域名/CDN配置仍未连接验证；本轮不提供已经上线或云端已通过的结论。
