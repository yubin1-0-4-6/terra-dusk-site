# 暮土 · Terra Dusk — 修改手册

写给以后想自己动手改这个站点的人（主要是未来的你）。
纯静态站点：没有数据库、没有后台、没有构建步骤。**改完存盘，刷新浏览器就生效。**

---

## 目录

1. [五分钟上手](#1-五分钟上手)
2. [文件地图](#2-文件地图)
3. [页面结构解剖](#3-页面结构解剖)
4. [改内容](#4-改内容)（最常用的一章）
5. [改样式](#5-改样式)
6. [改地球](#6-改地球)
7. [改交互逻辑](#7-改交互逻辑)
8. [新写一篇文章](#8-新写一篇文章)
9. [踩过的坑](#9-踩过的坑)
10. [改完怎么验](#10-改完怎么验)
11. [发布上线](#11-发布上线)
12. [附录](#12-附录)

---

## 1. 五分钟上手

### 1.1 起一个本地服务器

**必须用服务器，不能直接双击 `index.html`。** 因为 `file://` 协议下浏览器会拦截 WebGL、字体和部分 CSS 特性，地球会变成一块空白。

在这个项目根目录（`D:\Freebuff3\个人博客`，也就是本手册所在的文件夹）里开一个终端：

```bash
# Windows
python -m http.server 4173 --bind 127.0.0.1

# macOS / Linux
python3 -m http.server 4173 --bind 127.0.0.1
```

然后打开 <http://127.0.0.1:4173/index.html>。

**端口被占用**（报 `Address already in use`）就换一个，比如 `4174`、`8080`。

**服务被关掉了**（关终端、或者 Freebuff 重启）网站就打不开了，重新跑上面那条命令即可。文件不会丢。

想让它一直在后台跑：

```bash
# Windows Git Bash
(python -m http.server 4173 --bind 127.0.0.1 > .freebuff/server.log 2>&1 &)

# macOS / Linux
nohup python3 -m http.server 4173 --bind 127.0.0.1 > .freebuff/server.log 2>&1 &
```

### 1.2 用什么编辑器改

VS Code、Neovim、任何纯文本编辑器都行。这个站点**不需要** npm install、**不需要**打包、**不需要**编译。

唯一要注意的是：保存时编码用 **UTF-8**，缩进 2 空格，行尾 LF 或 CRLF 都无所谓。

### 1.3 改完怎么看效果

浏览器里按 `Ctrl + Shift + R`（Mac 是 `Cmd + Shift + R`）强制刷新，避开 CSS 缓存。
如果还看到旧样式，开发者工具里勾一下 Network 面板的 "Disable cache"。

---

## 2. 文件地图

```
个人博客/
├── index.html              首页（唯一带地球的页面）
├── about.html              关于页
├── 404.html                找不到页面（样式内联，任意路径下都能用）
├── MANUAL.md               ← 你正在读的手册
├── README.md               仓库首页的说明
├── LICENSE                 MIT
├── check.mjs               自动化检查脚本（node check.mjs）
├── favicon.svg             站点图标，6 个页面共用
├── robots.txt              搜索引擎规则
├── sitemap.xml             页面清单，加了新文章要补一条
├── _config.yml             发布排除清单（§11.4）
├── .github/workflows/
│   └── check.yml           推送 main 时自动跑 check.mjs
├── posts/                   文章页
│   ├── slow-practice.html    关于「慢」的一点练习
│   ├── terra-dusk.html       我用一个球体装下了整颗地球
│   ├── night-owl.html        深夜工作者的自白
│   └── quiet-web.html        把博客搬回自己手里
├── assets/
│   ├── css/
│   │   └── site.css         全站唯一样式表（1787 行，按区块分节）
│   ├── js/
│   │   ├── site.js          通用交互：菜单、时钟、揭示、筛选、进度条
│   │   └── globe.js         WebGL 地球（514 行）
│   ├── og.jpg              分享卡片图（1200×630，从首页截图裁的）
│   └── textures/            地球贴图
│       ├── earth_atmos_2048.jpg    昼面（地表）
│       ├── earth_lights_2048.png   夜面城市灯光
│       ├── earth_clouds_1024.png   云层（带 alpha）
│       └── earth_specular_2048.jpg 海洋高光 / 水体掩膜
├── screenshots/             历史截图（已在 _config.yml 里排除，不会上线）
└── .freebuff/               本地工具产物（服务器日志等）
```

**只需要记住三条规则：**

1. `index.html` 和 `about.html` 在根目录，资源路径写 `assets/...`；
   `posts/` 里的文章页在子目录，资源路径写 `../assets/...`、链接首页写 `../index.html`。
2. 样式**全部**在 `assets/css/site.css` 一个文件里，没有内联样式、没有 CSS 预处理器。
3. 首页才有地球。`globe.js` 只在 `index.html` 里被引入，文章页和关于页不要加。

---

## 3. 页面结构解剖

### 3.1 首页 `index.html` 从上到下

| 区块 | 元素 | 关键类名 / id | 说明 |
|---|---|---|---|
| 跳转链接 | `<a class="skip">` | `.skip` | 键盘 Tab 时出现的"跳到主要内容" |
| 顶栏 | `<header class="nav">` | `.nav` | 滚动超过 24px 加 `.is-scrolled` 变实底 |
| 地球 | `<canvas id="globe">` | `#globe` | 全屏 canvas，在 `.hero__stage` 里 |
| 地球降级占位 | `<div class="hero__fallback">` | `.hero__fallback` | 无 WebGL 时显示的 CSS 球；WebGL 就绪后被 JS 删除 |
| 昆明光点 | `<button class="hero__pin">` | `.hero__pin` | 每帧由 `globe.js` 定位；点击把云南转到正面 |
| 首屏文案 | `.hero__copy` | `.hero__copy` | 标题、导语、按钮、三项 meta |
| Now 栏 | `<section class="now">` | `.now` | 正在读 / 正在做 / 正在听 |
| 文章列表 | `<section id="writing">` | `.posts` / `.post` | 每篇一个 `<li class="post" data-tag="…">` |
| 标签筛选 | `.filters` | `.chip[data-filter]` | 全部 / 随笔 / 代码 / 生活 |
| 摘句 | `<section class="quote">` | `.quote` | 一句引文 + 出处 |
| 碎片 | `<section id="notes">` | `.notes` / `.note` | 三条短句 |
| 关于预览 | `<section id="about">` | `.about-teaser` | 圆形头像 + 自我介绍 |
| 联系 | `<section id="contact">` | `.contact__mail` | 邮箱 + 社交链接 |
| 页脚 | `<footer class="footer">` | `.footer__grid` | 版权 / 致谢 |

### 3.2 文章页 `posts/*.html`

结构固定，四段：

```
.progress > span          ← 顶部阅读进度条（只在文章页）
header.article__head      ← 返回链接 / 标签+日期 / 标题 / 导语 / byline
div.prose                 ← 正文
footer.article__foot      ← 标签列表 + 上一篇/下一篇
```

### 3.3 关于页 `about.html`

```
header.page-head          ← 大标题 + 一段话
section.bio               ← 左圆球 + 右自述 + .facts
section (年表)             ← ol.timeline
section (工具)             ← ul.toolkit
section.contact
```

---

## 4. 改内容

> 全部是纯文本替换。改完存盘，刷新。

### 4.1 站点名、标题、描述、图标

在 `<head>` 里，每个页面各有一份：

```html
<title>暮土 · Terra Dusk — 白鎏的个人博客</title>
<meta name="description" content="白鎏的个人博客：在地球的夜面写一点慢的东西。关于设计、代码与日常的观察。" />
<meta property="og:title" content="暮土 · Terra Dusk" />
<meta property="og:description" content="在地球的夜面，写一点慢的东西。" />
```

| 想改什么 | 改哪一行 |
|---|---|
| 浏览器标签页标题 | `<title>`（文章页格式：`文章标题 — 暮土 · Terra Dusk`） |
| 搜索结果摘要 | `<meta name="description">` |
| 分享到微信/Twitter 时的标题与描述 | `og:title` / `og:description` |
| 浏览器地址栏颜色（移动端） | `<meta name="theme-color" content="#02040a">` |
| 站点图标 | `<link rel="icon" href="favicon.svg">` —— 6 个页面共用同一个文件，根目录页写 `favicon.svg`，文章页写 `../favicon.svg` |

> **图标**：现在是一颗渐变球，画在 `favicon.svg` 里。想换成自己的，直接替换这个文件即可；如果改成别的文件名或放别的位置，记得 6 个页面的相对路径不一样（根目录页和 `posts/` 下各一套写法）。

### 4.2 品牌名「暮土 / Terra Dusk」

出现在三个地方，要一起改：

1. `.brand` 里的 `<span>暮土</span>` 和 `<span class="brand__latin">Terra Dusk</span>`（每个页面各一处）
2. `<title>` 和 `og:title`
3. `.footer__name` 里的 `暮土 · Terra Dusk`

### 4.3 邮箱

站内一共出现 **4 处** `hi@bailiu.ink`：

| 位置 | 页面 | 元素 |
|---|---|---|
| 顶栏「订阅」按钮 | 全部 6 页 | `.nav__cta` |
| 联系区大邮箱 | index + about | `.contact__mail` |
| 联系区 Email 链接 | index + about | `.socials` 第一项 |
| 关于页 `.facts` 里 | about | `<span>联系 <b>hi@bailiu.ink</b></span>` |

全局替换即可：`Ctrl+H` 搜 `hi@bailiu.ink` → 换成新邮箱。

### 4.4 社交链接

`index.html` 和 `about.html` 的 `.socials` 里：

```html
<a href="mailto:hi@bailiu.ink">Email</a>
<a href="https://github.com" rel="noopener">GitHub</a>
<a href="https://x.com" rel="noopener">X</a>
<a href="#writing">Archive</a>   ← about.html 里是 "../index.html#writing"
```

改 `href` 即可。`rel="noopener"` 建议保留。

### 4.5 首屏文案

`index.html` 的 `.hero__copy`：

```html
<p class="eyebrow">个人博客 · 云南 · 自 2026</p>
<h1 id="hero-title">在地球的<em>夜面</em>，<br />写一点慢的东西。</h1>
<p class="hero__lede">我是白鎏，白天做界面，夜里写字。……</p>
```

- `<em>` 里的字会被染成暮色并加下划线（`.hero h1 em`）。
- `<br />` 决定断行位置，想让标题自动换行就删掉它。
- `<span class="nw">` 是"不换行"标记，用在不想被折断的短语上。

首屏底部三项：

```html
<div><dt>坐标</dt><dd>25.04°N · 102.71°E</dd></div>
<div><dt>此刻</dt><dd><time data-clock>--:--</time> CST</dd></div>
<div><dt>天色</dt><dd data-sky>夜 · 18°C</dd></div>
```

- 坐标：纯文字，随便改。**注意**：它和地球上的光点是两套独立数据，改这里不会移动光点。要移动光点看 [§6.2](#62-光点坐标)。
- `data-clock` 由 JS 自动填成云南时间，别手写。
- `data-sky` 由 JS 自动填成"晨/昼/暮/夜 · 18°C"，别手写。温度写死在 `assets/js/site.js`。

### 4.6 Now 栏

```html
<div class="now__item"><span>正在读</span><strong>《惶然录》</strong><em>费尔南多 · 佩索阿</em></div>
```

三个 `<div>` 分别是 正在读 / 正在做 / 正在听，`<span>` 是标签，`<strong>` 是主内容，`<em>` 是补充说明。

想增删条目就复制整个 `<div class="now__item">`。
桌面端是 4 列（`0.75fr repeat(3, 1fr)`），加到第 4 条会挤；880px 以下变成 2 列。

### 4.7 文章列表（首页）

一篇文章 = 一个 `<li>`。完整模板：

```html
<li class="post" data-tag="随笔" data-reveal data-delay="1">
  <a class="post__link" href="posts/slow-practice.html">
    <span class="post__no">01</span>
    <span>
      <span class="post__meta">2026.10.12 · <b>随笔</b> · 6 分钟</span>
      <h3 class="post__title">关于「慢」的一点练习</h3>
      <p class="post__excerpt">我试着把一天里最快的那部分剪掉……</p>
    </span>
    <span class="post__arrow" aria-hidden="true">↗</span>
  </a>
</li>
```

| 字段 | 怎么改 |
|---|---|
| `data-tag` | **筛选用的标签**，必须和下面筛选按钮的 `data-filter` 值完全一致（见 §4.8） |
| `data-reveal` | 加上这个，滚动到时才有淡入动画 |
| `data-delay="1"` | 可选，延迟出现。只能是 `1`/`2`/`3`（CSS 里写死了 0.08/0.16/0.24 秒） |
| `href` | 文章页路径，文章放 `posts/` 下就写 `posts/xxx.html` |
| `.post__no` | 序号 `01` `02`… 自己维护，建议新的排在最前面并重新编号 |
| `.post__meta` | 日期 · 标签 · 阅读时长，三段用 ` · ` 分隔；标签用 `<b>` 包起来会显示成暮色 |
| `.post__title` | 标题 |
| `.post__excerpt` | 摘要，CSS 限制最多 2 行（720px 以下 3 行），超了会被截断 |

**排序**：`index.html` 里 `<ol class="posts">` 中 `<li>` 的先后顺序就是显示顺序（从新到旧）。加新文章放在 `<ol>` 的最前面。

**删文章**：删掉对应的 `<li>`，同时删掉 `posts/` 下的 html 文件，再修好上下篇链接（§8.3）。

### 4.8 标签筛选按钮

```html
<div class="filters" role="group" aria-label="按标签筛选文章">
  <button class="chip" data-filter="all" aria-pressed="true">全部</button>
  <button class="chip" data-filter="随笔" aria-pressed="false">随笔</button>
  <button class="chip" data-filter="代码" aria-pressed="false">代码</button>
  <button class="chip" data-filter="生活" aria-pressed="false">生活</button>
</div>
```

规则：

- `data-filter="all"` 的那个是「全部」，**必须保留**，且 `aria-pressed="true"`。
- 其余每个 `data-filter` 的值，必须**恰好**和至少一篇文章的 `data-tag` 一致，否则点下去会一篇都不剩。
- 按钮上的文字随便写，但值必须和 `data-tag` 一致（`data-filter="随笔"` 配 `data-tag="随笔"`）。
- 加新标签：加一个按钮 + 给文章的 `data-tag` 换值，两边同时改。
- `aria-pressed` 表示当前选中，JS 会自动维护，你只需要保证初始状态里只有 "all" 是 `true`。

### 4.9 摘句

```html
<blockquote>我们都在一颗每小时自转<span class="nw">一千六百七十公里</span>的星球上，假装自己很着急。</blockquote>
<cite>——《深夜工作者的自白》</cite>
```

`<cite>` 是出处，`--` 是中文破折号。`<span class="nw">` 防止短语被折行。

### 4.10 碎片（Notes）

```html
<article class="note" data-reveal data-delay="1">
  <time datetime="2026-10-09">2026.10.09</time>
  <p>今天把网站的字体换回了宋体。……</p>
  <span class="note__mark" aria-hidden="true">✳</span>
</article>
```

- `<time datetime="2026-10-09">` 是机器可读日期（ISO 格式），里面显示的文字是给人看的，格式随意。
- 桌面端 3 列（`.notes` 是 `repeat(3, 1fr)`），880px 以下自动变 1 列。加第 4 条会换行到第二排。
- `✳` 是右下角的装饰符号，换成别的符号也行。

### 4.11 关于预览（首页的 `.about-teaser`）

```html
<div class="facts">
  <span>现居 <b>云南</b></span>
  <span>工具 <b>Figma · VS Code</b></span>
  <span>时区 <b>UTC+8</b></span>
  <span>在线 <b>22:00 — 02:00</b></span>
</div>
```

`<b>` 里的内容是亮色显示。`.orb` 是那颗纯 CSS 画的球，`.orb__label` 是球上的字（"BAI LIU"）。

### 4.12 页脚

```html
<footer class="footer">
  <div class="wrap footer__grid">
    <span class="footer__name">暮土 · Terra Dusk</span>
    <span>© 2026 白鎏 · 由手写 HTML 与一个 WebGL 球体组成</span>
    <span>球体外观参考 <a href="https://www.originkit.dev/components/terra-dusk" rel="noopener">Originkit / Terra Dusk</a></span>
  </div>
</footer>
```

三个 `<span>`，桌面端横排、窄屏自动换行。版权年份手改。

---

## 5. 改样式

所有样式在 `assets/css/site.css`。文件按区块分节，每节前面有注释行（`/* ---- hero ---- */` 这种），用编辑器搜 `/*` 就能快速跳转。

### 5.1 改配色（最常用）

文件最开头 `:root` 里是一张变量表：

```css
:root {
  --bg: #02040a;                 /* 页面底色 */
  --bg-soft: #05080f;
  --panel: rgba(255, 255, 255, 0.028);
  --panel-strong: rgba(255, 255, 255, 0.05);
  --line: rgba(255, 255, 255, 0.085);          /* 分隔线 */
  --line-strong: rgba(255, 255, 255, 0.16);    /* 强分隔线 / 边框 */
  --ink: #e9edf4;                /* 正文亮色 */
  --ink-soft: #b8c1cf;           /* 次级文字 */
  --muted: #7e889a;              /* 弱化文字 / 元信息 */
  --dusk: #f0a778;               /* 暮色（强调色） */
  --dusk-deep: #d9793f;
  --sky: #82b6e6;                /* 天青（次强调色） */
  --dusk-glow: rgba(217, 121, 63, 0.13);
  --sky-glow: rgba(74, 132, 205, 0.16);
  --serif: "Instrument Serif", "Noto Serif SC", ...;   /* 标题字体 */
  --sans: "Inter", -apple-system, ...;                 /* 正文���体 */
  --wrap: 1180px;                /* 内容最大宽度 */
  --pad: clamp(1.25rem, 4vw, 2.5rem);   /* 两侧留白 */
  --ease: cubic-bezier(0.22, 0.61, 0.36, 1);  /* 缓动曲线 */
}
```

改 `--dusk` 一个值，全站的按钮高亮、下划线、光晕、引文标记、进度条都会跟着变。

> **暮色有个坑**：很多地方写的是硬编码的 `rgba(240, 167, 120, ...)`（对应 `#f0a778`），而不是 `var(--dusk)`。如果你把 `--dusk` 换成别的颜色，这些硬编码的地方**不会**跟着变。全局替换 `240, 167, 120` 可以一次改干净。

### 5.2 时段配色

`:root` 下面有三段按时段覆盖变量的规则，由 `assets/js/site.js` 给 `<html>` 加 `data-phase` 属性来切换：

```css
:root[data-phase="dawn"] { ... }   /* 晨 5:00–7:00 */
:root[data-phase="day"]  { ... }   /* 昼 7:00–16:00 */
:root[data-phase="night"] { ... }  /* 夜 19:00–次日 5:00 */
```

**「暮」（16:00–19:00）没有单独规则**，它用的是 `:root` 的默认值 —— 也就是说 `:root` 里那套颜色就是「暮」的配色。

想单独调暮色，加一段：

```css
:root[data-phase="dusk"] {
  --dusk: #e08a54;
  --dusk-deep: #c96d3d;
}
```

时段划分写在 `assets/js/site.js` 的 `markPhase()` 里，想改就在那里改小时区间。

### 5.3 字体

```css
--serif: "Instrument Serif", "Noto Serif SC", "Songti SC", "Source Han Serif SC", Georgia, serif;
--sans: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

- 拉丁文标题用 Instrument Serif，中文回落到 Noto Serif SC → 系统宋体。
- 字体来自 Google Fonts，**需要联网**。想完全离线，把字体文件下载到 `assets/fonts/`，用 `@font-face` 在 CSS 顶部声明，然后把 `--serif` / `--sans` 改成你的 `font-family` 名字。

字体链接在每个 HTML 的 `<head>`：

```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500&family=Noto+Serif+SC:wght@400;500&display=swap" rel="stylesheet" />
```

改字体就改这个 URL 的 `family=` 参数，同时改 CSS 里的 `--serif` / `--sans`。

### 5.4 常用组件 → 类名对照

| 想改什么 | 选择器 | 在 CSS 的哪一节 |
|---|---|---|
| 页面最大宽度 | `--wrap` | `:root` |
| 顶栏高度 | `.nav__inner { height: 4.75rem }` | nav |
| 顶栏滚动后变实底 | `.nav.is-scrolled` | nav |
| 品牌小圆球 | `.brand__orb` | nav |
| 大标题 | `.hero h1` | hero |
| 标题里的高亮词 | `.hero h1 em` | hero |
| 首屏按钮 | `.btn` / `.btn--solid` / `.btn--ghost` | hero |
| 地球容器 | `.hero__stage` | hero |
| 昆明光点的外观 | `.hero__pin` | hero |
| 光点旁边那个地名标签 | `.hero__pin__label` | hero |
| 无 WebGL 时的静态球 | `.hero__fallback` | hero |
| 摘句 | `.quote blockquote` | quote |
| 文章卡片 | `.post__link` | post list |
| 筛选按钮 | `.chip` | sections |
| 碎片卡片 | `.note` | notes |
| 关于页圆球 | `.orb` | about teaser |
| 联系区大邮箱 | `.contact__mail` | contact |
| 文章正文排版 | `.prose` | article |
| 代码块 | `.prose pre` / `.prose code` | article |
| 顶部阅读进度条 | `.progress span` | article |
| 上下篇 | `.pager` | article |
| 年表 | `.timeline` | about page |
| 工具列表 | `.toolkit` | about page |
| 滚动淡入动画 | `[data-reveal]` / `.is-in` | reveal |

### 5.5 响应式断点

CSS 里一共 5 个断点 + 2 个媒体查询：

| 断点 | 变了什么 |
|---|---|
| `@media (max-width: 900px)` | 顶栏折叠成「菜单」按钮，导航变成下拉面板；顶栏时钟隐藏 |
| `@media (max-width: 980px)` | 首屏改成竖排，球体区变成一条固定高度（`clamp(13rem, 36svh, 22rem)`）的横条；球体居中 |
| `@media (max-width: 880px)` | Now 栏 2 列、碎片 1 列、关于预览 1 列、工具列表 1 列、年表窄列 |
| `@media (max-width: 720px)` | 文章卡片变成 2 列（序号 + 正文），箭头隐藏，摘要最多 3 行 |
| `@media (max-width: 640px)` | 上下篇变成 1 列 |
| `@media (hover: none)` | 触摸设备上光点的「昆明」标签常驻显示（因为没法 hover） |
| `@media (prefers-reduced-motion: reduce)` | 关掉所有动画，`[data-reveal]` 直接可见 |

> 980px 这个断点**同时出现在 CSS 和 `globe.js` 里**。如果你改了其中一个，另一个也要改，否则球体位置和占位图会对不上（`globe.js` 里是 `const mobile = w < 980;`）。

### 5.6 常见外观调整速查

| 想要 | 改哪儿 |
|---|---|
| 球体再大一点 | `globe.js` → `resize()` → `Math.min(w * 0.46, h * 0.78)` 里的 `0.46` |
| 球体往右挪 | `globe.js` → `resize()` → `w * 0.235`（桌面横向偏移比例） |
| 球体上下挪 | `globe.js` → `resize()` → `-h * 0.01`（纵向偏移） |
| 地球倾角更斜 | `globe.js` → `const TILT_BASE = -0.30;` |
| 星星更多/更少 | `globe.js` → `gl.uniform1f(U.uStars, 0.85)` |
| 云层更厚 | `globe.js` → `gl.uniform1f(U.uCloud, 0.70)` |
| 城市灯更亮 | `globe.js` → `gl.uniform1f(U.uLights, 1.0)` |
| 整体更亮/更暗 | `globe.js` → shader 里 `col *= 1.0 - 0.26 * smoothstep(...)` 那行曝光控制 |
| 暗角更重 | shader 里 `col *= 1.0 - 0.30 * smoothstep(0.35, 1.20, length(vg));` |
| 页面底色更暖 | `:root` 的 `--bg` / `--dusk-glow` / `--sky-glow` |

---

## 6. 改地球

`assets/js/globe.js`，514 行。整个地球没有三维几何体：一张铺满屏幕的四边形，逐像素解球面方程。

### 6.1 它是怎么工作的

1. 拿到 `#globe` canvas，创建 WebGL 上下文。拿不到 → 加 `is-failed` 类，页面显示 CSS 占位球。
2. 编译一个顶点着色器 + 一个片元着色器。
3. 加载 4 张贴图。
4. 每帧：算当前太阳位置 → 传 uniform → 画 4 个顶点的三角形带 → 顺手把昆明光点摆到对应位置。

### 6.2 光点坐标

```js
const HOME = { lat: 25.04, lon: 102.71 };   // 昆明
```

- `lat` 纬度（北正），`lon` 经度（东正）。
- 想标别的城市就改成那个城市的经纬度，比如上海 `31.23, 121.47`，东京 `35.68, 139.69`。
- 光点的**文字标签**在 `index.html` 里，不在这个 JS 里：

```html
<button class="hero__pin" type="button" data-pin aria-label="把云南转到正面">
  <span class="hero__pin__label">昆明</span>
</button>
```

改这里两处：`aria-label` 和 `.hero__pin__label` 的文字。

> 换城市后**贴图不用动**——经纬度是真实地理坐标，跟贴图无关，贴图本来就是等距圆柱投影的全球图。

### 6.3 交互手感

| 参数 | 位置 | 作用 |
|---|---|---|
| `state.hoverTarget = px * 0.34` | pointermove | 鼠标左右视差幅度（越大转得越多） |
| `state.tiltTarget = py * 0.10` | pointermove | 鼠标上下视差幅度 |
| `state.spin += dx * 0.0042` | pointermove（拖动中） | 拖拽灵敏度 |
| `state.fling = Math.max(-2.4, Math.min(2.4, dx * 0.006))` | 同上 | 甩动惯性与上限 |
| `stiffness = 30` / `damping = 2 * Math.sqrt(stiffness) * 0.7` | `step()` | 视差弹簧的软硬 |
| `Math.min(1, dt * 6)` | `step()` | 点击归位的回中速度 |
| `Math.min(window.devicePixelRatio || 1, 2)` | `resize()` | 渲染分辨率上限（2 = 视网膜屏不浪费；1 = 省性能） |

拖动/甩动/回中都是**纯物理**，改坏了可以调上面的数，不要去改 shader。

### 6.4 换贴图

```js
const textures = [
  ['uDay',    'assets/textures/earth_atmos_2048.jpg'],
  ['uNight',  'assets/textures/earth_lights_2048.png'],
  ['uClouds', 'assets/textures/earth_clouds_1024.png'],
  ['uWater',  'assets/textures/earth_specular_2048.jpg'],
];
```

顺序不能改（顺序 = `gl.activeTexture(gl.TEXTURE0 + i)` 的绑定顺序）。

| 槽位 | 用途 | 要求 |
|---|---|---|
| `uDay` | 昼面地表 | 等距圆柱投影（equirectangular），2:1 宽高比，JPG/PNG |
| `uNight` | 夜面城市灯光 | 同上，黑色背景、城市是亮色块；代码只取亮度 |
| `uClouds` | 云层 | 同上，**必须带 alpha 通道**，只取 `.a` 通道 |
| `uWater` | 海洋高光掩膜 | 同上，**只取 `.r` 通道**当掩膜：海=白，陆=黑 |

新贴图扔进 `assets/textures/`，改上面的路径字符串即可。

> **投影必须是等距圆柱**。换成别的投影（比如正交投影贴图）会整体歪掉，而且不会报错。

### 6.5 Shader 调参

片元着色器在 `globe.js` 的 `const FRAG = \`` 那一段。常改的几处：

```glsl
const vec3 BG   = vec3(0.0016, 0.0030, 0.0072);   // 背景（星空底色）
const vec3 HAZE = vec3(0.055, 0.240, 0.640);       // 大气边缘的颜色

float halo = exp(-d * 38.0) * 0.55 + exp(-d * 7.0) * 0.09;   // 大气辉光的厚度
float day  = smoothstep(-0.03, 0.16, ndl);                   // 昼夜分界线的软硬
float rim  = pow(1.0 - z, 3.2);                              // 边缘大气强度
float edge = smoothstep(1.0015, 0.9970, r2);                 // 球体轮廓的抗锯齿

col += sunCol * exp(-d * 55.0) * pow(diffuse, 3.0) * 0.30;  // 高光侧的 bloom
col *= 1.0 - 0.26 * smoothstep(0.55, 0.98, uSun.z);          // 曝光：正午压高光
col *= 1.0 - 0.30 * smoothstep(0.35, 1.20, length(vg));      // 暗角
```

改 shader 有个重要约定：**`uSun` 是真实太阳方向**，`draw()` 里用 `subsolar(new Date())` 算出来。所以不管你几点打开，晨昏线都在正确的位置。想要"永远黄昏"就固定 `uSun`，但那样就失去了"按真实时间运行"这个特性。

### 6.6 性能与省电

已经内置的省电措施，别删：

- `IntersectionObserver`：球体滚出视口就停渲染。
- `document.visibilitychange`：切到别的标签页就停。
- `prefers-reduced-motion`：系统开了"减少动态效果"时，**只画一帧不转**，指针视差也关掉。
- `ResizeObserver`：只在尺寸真变了的时候重算。

想让低端机更省，把 `resize()` 里的 `Math.min(window.devicePixelRatio || 1, 2)` 改成 `1`，分辨率立刻掉一半。

### 6.7 无 WebGL 的降级

`index.html` 里：

```html
<div class="hero__stage" aria-hidden="true">
  <canvas id="globe"></canvas>
  <div class="hero__fallback"></div>
</div>
```

- `.hero__fallback` 是一颗纯 CSS 的暗球（`radial-gradient` + `blur(5px)` + `breathe` 呼吸动画）。
- WebGL 起来后，`globe.js` 的 `boot()` 里会在 1.6 秒后 `fallback.remove()`，把它从 DOM 里删掉。
- WebGL 失败时，`globe.js` 给 canvas 加 `is-failed`，占位球**保持可见**。
- 光点在降级时不可见：CSS 里 `.hero__pin { opacity: 0 }` 是初始值，`globe.js` 只有在真正画起来之后才会写 `opacity`。

想改占位球的样式，改 CSS 的 `.hero__fallback`（位置在 `left: 73.5%`，对应 WebGL 球心；980px 以下会改成 `left: 50%` 居中）。

---

## 7. 改交互逻辑

`assets/js/site.js`，115 行，一个 IIFE，里面 7 个互相独立的小块，每块都是"找到元素 → 绑事件"：

| 块 | 元素 | 行为 |
|---|---|---|
| 顶栏实底 | `.nav` | 滚动 > 24px 加 `.is-scrolled` |
| 折叠菜单 | `.nav__toggle` + `#nav-links` | 切换 `.nav.is-open`，同步 `aria-expanded`；Esc 关闭；点外部关闭 |
| 云南时钟 | 所有 `[data-clock]` | `Intl.DateTimeFormat` + `Asia/Shanghai`，每 15 秒刷新 |
| 时段天色 | `[data-sky]` + `<html data-phase>` | 每分钟检查，切换配色变量 |
| 滚动揭示 | 所有 `[data-reveal]` | 进入视口加 `.is-in` |
| 标签筛选 | `[data-filter]` + `.post[data-tag]` | 点击时给不匹配的加 `hidden` |
| 阅读进度 | `.progress span` | 滚动时写 `scaleX()` |

### 7.1 data-* 属性契约

这些属性是 HTML 和 JS 之间的约定，**不要随便改名**：

| 属性 | 用在哪 | 作用 |
|---|---|---|
| `data-clock` | 首页、全部页面 | 时钟占位，JS 填时间 |
| `data-sky` | 首页 | 天色占位，JS 填「晨/昼/暮/夜 · 18°C」 |
| `data-reveal` | 到处 | 滚动淡入 |
| `data-delay="1\|2\|3"` | 配合 `data-reveal` | 淡入延迟 |
| `data-filter="..."` | 首页筛选按钮 | 筛选值，必须和 `data-tag` 一致 |
| `data-tag="..."` | 首页文章条目 | 标签值 |
| `data-pin` | 首页光点 | 标记（当前 JS 实际用 `.hero__pin` 选择器，`data-pin` 只是语义标记） |

### 7.2 加一个新交互

在 `site.js` 的 IIFE 里追加一块，模式如下：

```js
/* 我的新功能：标题点击后随机换颜色 */
const titles = document.querySelectorAll('.post__title');
titles.forEach((title) => {
  title.addEventListener('click', () => {
    title.style.color = `hsl(${Math.random() * 360}, 60%, 70%)`;
  });
});
```

要点：

1. **先判断元素存不存在**再绑定，否则在 `about.html` 上会报错：
   ```js
   const el = document.querySelector('.foo');
   if (el) { /* ... */ }
   ```
2. 整段包在 IIFE 里（`(() => { ... })();`），不要污染全局变量。
3. 不要用 `document.write`，不要用 `innerHTML` 拼 HTML（会有 XSS 风险且破坏事件绑定）。
4. 改完存盘刷新即可，不需要编译。

### 7.3 检查 site.js 有没有报错

浏览器开发者工具（F12）→ Console。任何红色报错都会显示在这里。
测试筛选/菜单这类交互时，记得 Console 里不能有红字。

---

## 8. 新写一篇文章

### 8.1 建文件

在 `posts/` 下新建 `xxx.html`（文件名用英文 kebab-case，比如 `on-slow-writing.html`）。
**复制** [posts/slow-practice.html](posts/slow-practice.html) 作为模板最省事。

### 8.2 文章页模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>你的标题 — 暮土 · Terra Dusk</title>
  <meta name="description" content="一到两句话摘要。" />
  <meta name="theme-color" content="#02040a" />
  <link rel="icon" href="data:image/svg+xml,……" />      <!-- 和其他页面一模一样 -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=…" rel="stylesheet" />
  <link rel="stylesheet" href="../assets/css/site.css" />   <!-- 注意 ../ -->
</head>
<body>
  <a class="skip" href="#main">跳到正文</a>
  <div class="progress" aria-hidden="true"><span></span></div>   <!-- 阅读进度条 -->

  <header class="nav"> …和 index.html 完全一样，只有 href 加 ../ … </header>

  <main id="main">
    <article>
      <header class="article__head wrap">
        <a class="back" href="../index.html#writing">← 返回写作</a>
        <p class="eyebrow">随笔 · 2026.10.20</p>          <!-- 标签 · 日期 -->
        <h1>你的标题</h1>
        <p class="article__lede">一段导语，一到两句话。</p>
        <div class="article__byline">
          <span><b>白鎏</b></span>
          <span>5 分钟阅读</span>
          <span>写于云南 · 凌晨一点</span>
        </div>
      </header>

      <div class="prose wrap">
        <p>正文段落。</p>

        <h2 data-num="01">第一节标题</h2>
        <p>正文段落。</p>

        <blockquote><p>引用。</p></blockquote>

        <ul><li>列表项</li></ul>
        <pre><code>代码块</code></pre>
      </div>

      <footer class="article__foot wrap">
        <div class="tags">
          <span class="tag">随笔</span>
          <span class="tag">注意力</span>
        </div>
        <nav class="pager" aria-label="上一篇与下一篇">
          <a href="xxx.html"><span>上一篇</span><strong>上一篇的标题</strong></a>
          <a class="is-next" href="yyy.html"><span>下一篇</span><strong>下一篇的标题</strong></a>
        </nav>
      </footer>
    </article>
  </main>

  <footer class="footer"> …和 index.html 完全一样 … </footer>

  <script src="../assets/js/site.js" defer></script>
</body>
</html>
```

### 8.3 正文能用哪些标签

`.prose` 里已经排好版的有：

`p` `h2`（`data-num="01"` 会显示成小号序号） `h3` `strong` `em` `a` `blockquote` `ul` `ol` `li` `code` `pre` `hr` `figure` + `img` + `figcaption`

写代码块：

```html
<pre><code>const x = 1;</code></pre>
```

不要在 `.prose` 里用 `<div>`（`max-width` 规则只作用于 `.prose > *`，结构变了宽度会乱）。

### 8.4 发布一篇文章要做五件事

1. **建文件**：`posts/xxx.html`（§8.2）
2. **加进首页列表**：在 `index.html` 的 `<ol class="posts">` **最前面**插一段 `<li class="post">`（§4.7），记得 `data-tag` 和筛选按钮对得上
3. **改上下篇**：新文章的 `<nav class="pager">` 里填上一/下一篇；**原来那篇**的 pager 也要把指向新文章的链接换掉
4. **补 sitemap**：在 `sitemap.xml` 里加一条 `<url>`，`lastmod` 写发布日期
5. **跑检查**：`node check.mjs`（§10）—— 标题、日期、标签、分钟数、上下篇、sitemap 有任何一处对不上都会当场报出来

### 8.5 当前的上下篇关系（改之前先看这个）

| 文章 | 上一篇 | 下一篇 |
|---|---|---|
| [slow-practice](posts/slow-practice.html) | 把博客搬回自己手里 | 我用一个球体装下了整颗地球 |
| [terra-dusk](posts/terra-dusk.html) | 关于「慢」的一点练习 | 深夜工作者的自白 |
| [night-owl](posts/night-owl.html) | 我用一个球体装下了整颗地球 | 把博客搬回自己手里 |
| [quiet-web](posts/quiet-web.html) | 深夜工作者的自白 | 关于「慢」的一点练习 |

（这是个环。加新文章时把它接进环里：让最老的一篇的「下一篇」指向新文章，新文章的「上一篇」指向最老的一篇。）

---

## 9. 踩过的坑

### 9.1 直接双击 HTML 打开

`file://` 下 WebGL 拿不到上下文，地球是一块黑。**必须用本地服务器。**（§1.1）

### 9.2 posts/ 里的路径忘了加 `../`

文章页在子目录里。样式是 `../assets/css/site.css`，脚本是 `../assets/js/site.js`，首页是 `../index.html`。写漏了 `../` 会 404，页面全白。

### 9.3 筛选按钮和 `data-tag` 对不上

点某个标签后一篇文章都没有 —— 因为没有一篇的 `data-tag` 等于那个值。要么改按钮的 `data-filter`，要么改文章的 `data-tag`，两边字面完全一致（包含标点）。§4.8。

### 9.4 改了 CSS 没生效

浏览器缓存。`Ctrl + Shift + R` 强刷。

### 9.5 换了新文章，check.mjs 报筛选失败

脚本从页面里自己数「有几篇、每个标签几篇」，所以加文章不需要改脚本。它报错通常说明页面本身对不上：

- 首页的筛选按钮（`data-filter`）多了一个页面上没有的标签，或漏了一个正在用的标签；
- 某篇文章的 `data-tag` 拼错了（例如写成 `代码 ` 带了个空格）；
- 索引里某篇的标题/日期/标签/分钟数和正文页眉不一致——脚本会把两边的值打出来对照。

### 9.6 换了球体大小，占位图对不上

`.hero__fallback` 的 `left: 73.5%` 是写死的，跟 `globe.js` 里 `w * 0.235` 是同一个值的两份拷贝。改了 `globe.js` 的偏移量，CSS 里的 `73.5%` 要同步改（`50% + 23.5%`）。980px 以下两处都走居中，不受影响。

### 9.7 地球整个偏了 / 上下颠倒

贴图投影不对，或者 shader 里 `uv` 的 Y 方向弄反了。当前实现是 `vec2 uv = vec2(lon / (2π) + 0.5, 0.5 - lat / π)` —— 减号是为了让北极朝上。改贴图时别改这一行。

### 9.8 断网后字体变样

Google Fonts 加载不到时，标题会回落到系统宋体 / Georgia。要完全离线就自托管字体（§5.3）。

### 9.9 中文标点

`—`（em dash）、`·`（间隔号）、`「」`（直角引号）都是直接写的中文字符，不需要转义。
但 HTML 里 `<`、`>`、`&` 要转义成 `&lt;` `&gt;` `&amp;`。

### 9.10 改了 `site.js` 但文章页没有阅读进度条

进度条是文章页独有的 `<div class="progress">`。`site.js` 找不到 `.progress span` 就什么都不做，这是正常降级。

---

## 10. 改完怎么验

### 10.1 自动检查

项目根目录有 [check.mjs](check.mjs)：零依赖，自己起服务器、自己拉无头 Chrome，用真实鼠标事件驱动页面。

```bash
node check.mjs            # 只看结果
node check.mjs --verbose  # 附带每项的实测数字
```

需要 **Node 20+** 和本机的 Chrome/Chromium。Chrome 不在默认位置的话：

```bash
CHROME="/path/to/chrome" node check.mjs --verbose
```

它检查 26 项：

| 分组 | 检查项 |
|---|---|
| 地球 | 初始化成功、WebGL 上下文没丢 |
| 光点 | 落在球盘内、悬停出地名、拖动跟着转、点击归位误差 < 2.5px、归位后不漂移、转到背面隐藏且不可点 |
| 首页 | 每个筛选按钮都对得上一个正在用的标签；点每个标签后剩下的篇数等于页面上该标签的篇数（数字从页面读，不写死） |
| 文章 | 阅读进度 0 → 0.5~0.75 |
| 移动端 | 390 宽下地球照常渲染、无横向溢出、菜单按钮显示 |
| 降级 | 无 WebGL 时球体报失败、静态占位可见、光点隐藏、无控制台报错 |
| 一致性 | 首页列出的每篇都在 `posts/` 里、没有漏收的文章；索引的标题/日期/标签/分钟数与正文一致；上下篇指向的标题正确；没有死链或丢失的资源；`sitemap.xml` 覆盖全部页面 |
| 全局 | 无控制台报错 |

**任何一项失败，退出码就是 1**，可以直接接进 CI 或 git hook：

```bash
node check.mjs || exit 1
```

仓库里已经接好了：`.github/workflows/check.yml` 会在每次推送到 `main`（以及开 PR）时跑同一份脚本。CI 里 Chrome 需要关 sandbox，脚本检测到 `CI` 环境变量会自动加 `--no-sandbox`。

### 10.2 手动过一遍

1. 首页：地球在转、鼠标移上去球会轻微跟着动、拖动能转、甩一下有惯性、点「昆明」光点球会转回云南那一面。
2. 顶栏：往下滚，顶栏变实底；滚回去还原。
3. 筛选：点「随笔」只剩随笔，点「全部」恢复。
4. 窄屏（浏览器拖窄到 < 900px）：顶栏出现「菜单」按钮，点开是竖排导航，按 Esc 关闭。
5. 文章页：顶部有一条进度条，滚动时从左往右走。
6. 关于页：年表、工具列表正常。

### 10.3 顺手截图存档

项目里有历史截图放在 `screenshots/`。想自己存一份，可以用浏览器的开发者工具 → 命令面板（`Ctrl+Shift+P`）→ `Capture full size screenshot`。

---

## 11. 发布上线

### 11.1 前提

这是一个纯静态站点，**没有任何服务端代码**。发布就是把整个文件夹丢到任何能托管静态文件的地方。

### 11.2 现在的方式：GitHub Pages

仓库 <https://github.com/yubin1-0-4-6/terra-dusk-site>（public），Pages 用的是 legacy 源：Settings → Pages → Source 选 `main` 分支 `/ (root)`。线上地址 <https://yubin1-0-4-6.github.io/terra-dusk-site/>。

日常发布只有三步：

```bash
git add -A
git commit -m "新文章：xxx"
git push
```

推送后 Pages 自动重建，一两分钟生效；回滚就是 `git revert` 再推一次。构建时 Jekyll 会跑一遍，但站点没有任何 Liquid 标签，HTML 原样输出（§11.4）。

### 11.3 换别的地方托管

同一份文件夹也能直接交给 nginx / Caddy / 任何静态托管：

```bash
rsync -av --delete ./ user@host:/var/www/terra-dusk/
```

站点是**多页面**结构（`index.html`、`about.html`、`404.html`、`posts/*.html`），不需要任何重写规则；`404.html` 的样式是内联的，托管方把找不到的路径指过去就能用。

注意 `sitemap.xml`、`robots.txt` 和页面里的 `og:url` / `og:image` 都写死了 `yubin1-0-4-6.github.io/terra-dusk-site` 这个前缀，换域名要一起改。

### 11.4 哪些文件不会上线

`_config.yml` 里列了排除项：`MANUAL.md`、`README.md`、`LICENSE`、`check.mjs`、`screenshots/`、`.freebuff/`、`freebuff-sites-build/`、`.cloud-attachments/`。它们照常留在仓库里，但不会被发布出去。

这个文件是 Jekyll 的配置，而站点本身**不使用任何 Jekyll 特性**——不要在 HTML 里写 `{{ }}` 或 `{% %}`，会被 Jekyll 当模板执行掉。新增内部文件（日志、脚本、备份）时，记得往 `exclude` 里补一行。

### 11.5 上线前检查清单

- [ ] `node check.mjs` 全绿（26 项，含页面之间的交叉检查）
- [ ] 每个页面的 `<title>` 和 `<meta name="description">` 都改过了
- [ ] 新文章加进了 `sitemap.xml`
- [ ] 邮箱不是测试用的
- [ ] 社交链接指向真实的账号
- [ ] 版权年份是当前年份
- [ ] 手机上看一眼：顶栏折叠、球体居中、没有横向滚动条

---

## 12. 附录

### 12.1 全部页面清单

| 文件 | 标题 | 带地球 | 带进度条 |
|---|---|---|---|
| `index.html` | 暮土 · Terra Dusk — 白鎏的个人博客 | ✅ | ❌ |
| `about.html` | 关于 — 暮土 · Terra Dusk | ❌ | ❌ |
| `404.html` | 找不到这一页 — 暮土 · Terra Dusk | ❌ | ❌ |
| `posts/slow-practice.html` | 关于「慢」的一点练习 | ❌ | ✅ |
| `posts/terra-dusk.html` | 我用一个球体装下了整颗地球 | ❌ | ✅ |
| `posts/night-owl.html` | 深夜工作者的自白 | ❌ | ✅ |
| `posts/quiet-web.html` | 把博客搬回自己手里 | ❌ | ✅ |

### 12.2 类名速查

<details>
<summary>展开全部类名（共 100+ 个，按区块）</summary>

**通用**：`.skip` `.wrap` `.eyebrow` `.dot` `.btn` `.btn--solid` `.btn--ghost` `.btn__glyph` `.text-link` `.nw` `.facts` `.orb` `.orb__label`

**顶栏**：`.nav` `.nav.is-scrolled` `.nav.is-open` `.nav__inner` `.brand` `.brand__orb` `.brand__latin` `.nav__links` `.nav__right` `.nav__clock` `.nav__toggle` `.nav__cta`

**首屏**：`.hero` `.hero__stage` `.hero__scrim` `.hero__inner` `.hero__copy` `.hero__lede` `.hero__actions` `.hero__meta` `.hero__scroll` `.hero__pin` `.hero__pin__label` `.hero__fallback`

**Now 栏**：`.now` `.now__grid` `.now__label` `.now__item`

**区块**：`.section` `.section--tight` `.section__head` `.section__note` `.section__foot`

**列表**：`.filters` `.chip` `.posts` `.post` `.post__link` `.post__no` `.post__meta` `.post__title` `.post__excerpt` `.post__arrow`

**摘句**：`.quote` `.quote__inner`

**碎片**：`.notes` `.note` `.note__mark`

**关于预览**：`.about-teaser`

**联系**：`.contact` `.contact__inner` `.contact__mail` `.socials`

**页脚**：`.footer` `.footer__grid` `.footer__name`

**文章页**：`.progress` `.article__head` `.article__lede` `.article__byline` `.prose` `.article__foot` `.tags` `.tag` `.pager` `.pager .is-next` `.back`

**关于页**：`.page-head` `.bio` `.bio__body` `.timeline` `.toolkit`

**揭示动画**：`[data-reveal]` `.is-in`

**球体状态**：`#globe.is-ready` `#globe.is-failed`

</details>

### 12.3 命令速查

```bash
# 本地预览
python -m http.server 4173 --bind 127.0.0.1

# 自动检查
node check.mjs
node check.mjs --verbose

# 找某个类/属性用在哪
grep -rn "hero__pin" --include=*.html --include=*.css --include=*.js .

# 看服务器日志
tail -f .freebuff/server.log

# 谁在占用 4173
netstat -ano | grep :4173        # Windows
lsof -i :4173                    # macOS / Linux
```

### 12.4 改完之后

1. 存盘
2. `Ctrl + Shift + R` 刷新
3. F12 看 Console 有没有红字
4. `node check.mjs` 跑一遍
5. 窄屏再看一眼

---

*暮土 · Terra Dusk — 手写 HTML 与一个 WebGL 球体组成。*
