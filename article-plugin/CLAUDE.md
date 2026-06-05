# Article Plugin — 技术调研文章增强

## 功能定位
对技术调研文章进行多维度审查、内容扩充、事实校验、风格去 AI 化，并支持多轮迭代改写。

## 架构
两层 Agent 工作流 + 图示渲染 + 迭代改写：

### 第一层：并行分析（最多 8 个 Agent）
- `article-accuracy-checker` — opus, WebSearch, 事实验证+引用查找+术语检查
- `article-accuracy-checker-hermes` — haiku+hermes, 准确性审查的 Hermes 多样性视角（可选，需 hermes CLI；不联网，仅训练知识标注怀疑）
- `article-content-reviewer` — opus, 技术深度+论证逻辑+章节结构
- `article-content-reviewer-codex` — haiku+codex, 内容审查的 Codex 多样性视角（可选，需 codex CLI）
- `article-content-reviewer-hermes` — haiku+hermes, 内容审查的 Hermes 多样性视角（可选，需 hermes CLI）
- `article-style-auditor` — opus, 去 AI 味核心 Agent，检测模板化表达；内置确定性 AI 味词典（5 类黑名单），审计前用 Grep 逐条扫全文、命中即 🔴 必改，叠加模型自由判断取并集，确属术语者走「术语豁免」
- `article-style-auditor-hermes` — haiku+hermes, 风格审计的 Hermes 多样性视角（可选，需 hermes CLI）
- `article-visual-planner` — sonnet, WebSearch, 规划图示、截取参考图；支持 `claude`（暖米黄牛皮纸调）与 `feishu`（飞书/Lark 明亮产品 UI 调）两套图示风格预设，由命令在启动前 AskUserQuestion 询问用户、以 `风格:` 参数注入，全文图示统一该风格

### /explain 专用 Agent
- `article-translator` — opus, WebSearch, 英文 → 中文准确翻译，保留专业术语，输出术语对照表
- `article-related-finder` — sonnet, WebSearch+WebFetch, 检索相关论文/项目并核验链接
- `article-explainer` — opus, 合成讲解稿（译文 + 译注 + 图示 + 延伸阅读），单轮成稿

### 第二层：聚合（1 个 Agent）
- `article-review-aggregator` — opus, 汇总全部报告，三方交叉验证（Claude × Codex × Hermes），生成统一审查报告

### 图示渲染（1 个 Agent，必须在改写前完成）
- `article-diagram-renderer` — sonnet, Read/Write/Grep/Glob/Bash, 从 visual-planner 报告抽取 ```svg 代码块并落盘为 `.svg` 文件，供 rewriter 插入文章

### 迭代改写与验证循环（1 个 Agent + 验证回路）
- `article-rewriter` — opus, AskUserQuestion, 根据审查报告逐条修改
- 每轮修改后重跑 content-reviewer + style-auditor + review-aggregator
- 循环最多 2 轮（第 1 轮初稿，第 2 轮验证 + 必要时再补一次改写），N=2 后即使仍有 🔴 也强制退出，未解决问题在 `06-revision-notes.md` 标注
- 每轮过程文件写入独立目录 `rewrite-round-N/`

## 命令
- `/review <file>` — 快速审查，不修改（commands/review.md）
- `/enhance <file>` — 完整增强，含迭代改写（commands/enhance.md）
- `/explain <file 或 URL>` — 英文论文/网页文章中文讲解（commands/explain.md）
  - 单轮成稿；输入支持 URL / PDF / .md
  - 工作目录 `.article-work-explain/`，与 `/review` `/enhance` 互不干扰
  - 复用 accuracy-checker / visual-planner / diagram-renderer
  - 新增 article-translator / article-related-finder / article-explainer 三个 Agent

## 中间文件
- `/review` 和 `/enhance`：所有中间状态写入 `.article-work/` 目录
  - PDF 输入时，`.article-work/origin.pdf` 保留原始文件，`.article-work/img/` 保留提取图片
  - 各轮次文件在 `.article-work/rewrite-round-N/`
  - 文件命名约定：01-accuracy, 01-accuracy-hermes, 02-content, 02-content-codex, 02-content-hermes, 03-style, 03-style-hermes, 04-visual, 05-review-report, 06-revised-origin, 06-revision-notes（带 `-hermes` 后缀的均为可选输出）
- `/explain`：所有中间状态写入 `.article-work-explain/` 目录（独立于上者）
  - 输入统一为 `source/origin.md`（PDF 时同时保留 `source/origin.pdf`、URL 时同时保留 `source/origin.url`）
  - 图片在 `img/`（fig_N.* + diagram_N.svg）
  - 文件命名约定：01-translation, 02-accuracy, 02-accuracy-hermes（可选）, 03-related, 04-visual, 05-explanation

## PDF 输入
- `.pdf` 输入先预处理为 `origin.pdf + img/ + rewrite-round-1/origin.md`
- 论文 figure 在 PDF 中往往被切成几十个小 image XObject（例如 8x8 的 demo grid），脚本不会逐 XObject 导出；改用 pdfplumber 拿到每张 image 的页面坐标，按竖向间距聚类后对每个 cluster 的并集 bbox 渲染为单张 PNG（DPI=180）。一页两个 figure 自然拆成两张 PNG，避免 `img/` 出现数百个碎片。
- 输出文件统一为 `img/fig_N.png`
- `rewrite-round-1/origin.md` 中图片以 `![fig_N](../img/fig_N.png)` 引用

## Codex 集成
- `scripts/codex-task.mjs` — 精简版 Codex 运行时（`codex app-server` JSON-RPC）
- Codex agent 是 haiku 转发器：读文章 → 组装 prompt → 调用 codex-task.mjs → 写入结果
- 需要 `codex` CLI 已安装且 `codex login status` 显示已登录，不可用时自动跳过

## Hermes 集成
- `scripts/hermes-task.mjs` — 精简版 Hermes Agent 运行时（`hermes chat -q ... -Q`）；支持 `--check` 冒烟测试（exit 0/1）
- Hermes agent 是 haiku 转发器，与 Codex agent 同形：读文章 → 组装 prompt → 调用 hermes-task.mjs → 写入结果
- 三个 Hermes agent 共用同一脚本，prompt 文件分别命名为 `.hermes-prompt-{content,style,accuracy}.md`
- 需要 `hermes` CLI 已安装且冒烟测试通过：先 `which hermes`，再运行 `node hermes-task.mjs --check`（30s 超时验证实际可响应）；任一失败则自动跳过整套 Hermes
- Hermes 不接收图片输入；模型/Provider 由用户的 `hermes model` 全局配置决定，插件不指定
- 价值：在 Claude+Codex 之外提供第三方模型视角，聚合 Agent 做 3-way 交叉验证（≥2 路一致 → 高置信；2-of-3 多数 → 采纳多数；孤立观点 → 待复核）

## Skills
- `article-examples` — 参考文章库（examples/ 目录）
- `pdf` — PDF 读取和处理

## Agent 文件格式
使用 YAML frontmatter：`name`, `description`, `tools`, `model`。
