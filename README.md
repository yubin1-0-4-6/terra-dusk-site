# 暮土 · Terra Dusk

白鎏的个人博客。零构建、零依赖：每个页面都是手写的 HTML，样式一份 CSS，首页那颗会转的地球是一段原生 WebGL（片元着色器里求解球面，没有模型也没有贴图球）。

线上地址：<https://yubin1-0-4-6.github.io/terra-dusk-site/>

## 目录

```
index.html              首页：地球、文章索引、碎片、关于、联系
about.html              关于我
404.html                找不到页面（自包含，可出现在任意路径下）
posts/                  四篇文章，各自独立成页
assets/css/site.css     全部样式（含设计令牌与 reduced-motion 分支）
assets/js/site.js       导航、时钟、天色、滚动渐显、标签筛选、阅读进度
assets/js/globe.js      WebGL 地球与昆明光点
assets/textures/        四张地球贴图
favicon.svg             站点图标
robots.txt, sitemap.xml 搜索引擎入口
check.mjs               冒烟测试 + 内容一致性检查
MANUAL.md               完整的中文手册（维护、改动约定、踩过的坑）
```

## 本地预览

地球需要真正的 WebGL，`file://` 打开会失效，所以必须走 HTTP：

```bash
python -m http.server 4173 --bind 127.0.0.1
# 打开 http://127.0.0.1:4173/index.html
```

## 校验

```bash
node check.mjs --verbose
```

需要 Node 22+ 和本机 Chrome（用 `CHROME=/path/to/chrome` 指定别的浏览器）。脚本会自己起一个随机端口的静态服务器，用无头 Chrome 跑完地球、标签筛选、阅读进度、昆明光点的悬停/拖拽/回正、390px 移动端布局，以及无 WebGL 时的降级路径；随后离线交叉检查页面之间的一致性——索引里的标题/日期/标签/分钟数与正文是否一致、上一篇下一篇是否指向正确的标题、有没有死链、sitemap 是否覆盖全部页面。

推送到 `main` 时 GitHub Actions 会自动跑同一份脚本（`.github/workflows/check.yml`）。

## 发布

仓库根目录直接作为 GitHub Pages 的源（legacy 构建，`main` 分支 `/`）。没有构建步骤：`git push` 之后一两分钟线上生效，回滚就是 `git revert`。

`_config.yml` 只用来把内部文件排除在发布产物之外（`MANUAL.md`、`README.md`、`LICENSE`、`check.mjs`、`screenshots/`）。它是 Jekyll 的配置，但站点本身不使用任何 Jekyll 特性——页面里没有 Liquid 标签，HTML 原样发布。

## 许可

MIT，见 [LICENSE](LICENSE)。转载文章请先写信：<hi@bailiu.ink>。
