# Article Enhancement Plugin

技术调研文章多维度审查、增强与翻译讲解插件。通过 11 个专业 Agent 协同工作：对中文文章做事实校验、深度分析、去 AI 味、术语规范化与多轮迭代改写；对英文论文/网页做翻译 + 译注 + 图示 + 延伸阅读的中文讲解稿。

## 安装

### 1. 克隆仓库

```bash
git clone <repo-url>
cd artist
```

### 2. 安装为 Claude Code 插件

```bash
# 从 article-plugin 目录安装（路径指向包含 .claude-plugin/plugin.json 的目录）
claude plugins install ./article-plugin

# 验证安装
claude plugins list
```

安装成功后会显示 `article@article` 状态为 enabled。

### 3. 安装依赖（按需）

```bash
# PDF 处理（如果需要处理 PDF 输入）
pip install pypdf

# Codex CLI（可选，提供多模型审查视角）
# 参考 https://github.com/openai/codex 安装
```

图示由 `article-visual-planner` 直接输出 SVG 源码，`article-diagram-renderer` 仅负责落盘为 `.svg` 文件，无需额外安装渲染工具链。（可选：安装 `libxml2-utils` 的 `xmllint` 以启用 SVG 格式校验。）

### 4. 重启 Claude Code

插件安装或更新后需要重启 Claude Code 才能生效。

### 更新插件

当仓库有新提交后：

```bash
git pull
claude plugins update article@article
# 重启 Claude Code
```

## 架构

### /review 与 /enhance（中文文章审查 + 增强）

```
第一层：并行分析（最多 5 个 Agent）
├── article-accuracy-checker         opus    事实+引用+术语 + WebSearch
├── article-content-reviewer         opus    深度+逻辑+结构
├── article-content-reviewer-codex   haiku   Codex 多样性视角（可选）
├── article-style-auditor            opus    去 AI 味核心
└── article-visual-planner           sonnet  视觉规划 + WebSearch

第二层：聚合
└── article-review-aggregator        opus    汇总全部报告 + 交叉验证

图示落盘
└── article-diagram-renderer         sonnet  抽取 SVG 代码块并写入 .svg

迭代改写
└── article-rewriter                 opus    根据报告逐条修改 + 用户交互
    └── 每轮修改后重跑 content-reviewer + style-auditor + aggregator
    └── 循环直到无 🔴 严重问题，最多 3 轮
```

### /explain（英文论文/网页中文讲解）

```
输入预处理
├── URL              WebFetch 抓取为 markdown
├── PDF              prepare_article_pdf.py 提取正文 + 图片
└── Markdown         直接拷贝
   └── 输出 source/origin.md + img/

第一层：并行分析（4 个 Agent，单条消息同时启动）
├── article-translator            opus    英→中翻译，术语对照表
├── article-accuracy-checker      opus    事实+引用+术语校验（复用）
├── article-related-finder        sonnet  WebSearch+WebFetch 找相关文献并核验链接
└── article-visual-planner        sonnet  规划 SVG 图示（复用）

图示落盘
└── article-diagram-renderer            sonnet  落盘到 .article-work-explain/img/

第二层：合成（单 Agent，单轮成稿）
└── article-explainer             opus    译文 + 译注 + 图示 + 延伸阅读 → 中文讲解稿
```

## 命令

### `/review <file>` — 快速审查

对文章进行多维度审查，输出综合审查报告。不做修改。

```bash
/review my-article.md
/review paper.pdf
```

### `/enhance <file>` — 完整增强

审查 + 图示生成 + 多轮迭代改写的完整流程。

```bash
/enhance my-article.md
/enhance paper.pdf
```

支持 `--resume` 从中断处继续。

### `/explain <file 或 URL>` — 英文文章中文讲解

把英文论文或网页文章翻译为中文，并加入事实订正、相关文献、SVG 图示，单轮输出可发布的讲解稿。

```bash
/explain https://arxiv.org/abs/2401.12345
/explain paper.pdf
/explain english-blog.md
```

工作目录为 `.article-work-explain/`（与 `/review` `/enhance` 互不影响）；最终成稿位于 `.article-work-explain/05-explanation.md`。支持 `--resume`。

## 支持的输入格式

- **Markdown (.md)** — 直接处理
- **PDF (.pdf)** — 自动预处理为 Markdown + 提取嵌入图片
- **URL** — 仅 `/explain` 支持，通过 WebFetch 抓取为 markdown

## 中间文件

### `/review` 与 `/enhance`：写入 `.article-work/`

```
.article-work/
  origin.pdf                 PDF 原件（仅 PDF 输入）
  img/                       图片目录
    fig_N.{jpg,png}          PDF 提取图
    diagram_N.svg            SVG 图示（visual-planner 生成 + renderer 落盘）
  rewrite-round-1/           第1轮
    origin.md                输入文章
    01-accuracy.md           准确性审查（事实+引用+术语）
    02-content.md            内容审查（深度+逻辑+结构）
    02-content-codex.md      内容审查 Codex（可选）
    03-style.md              风格审计
    04-visual.md             视觉规划
    05-review-report.md      综合审查报告
    06-revised-origin.md     改写后文章
    06-revision-notes.md     改写说明
  rewrite-round-N/           后续轮次
```

### `/explain`：写入 `.article-work-explain/`

```
.article-work-explain/
  source/
    origin.md                英文原文（统一形态）
    origin.pdf               PDF 输入时保留
    origin.url               URL 输入时保留
  img/
    fig_N.{jpg,png}          PDF 提取图
    diagram_N.svg            visual-planner 生成、renderer 落盘
  01-translation.md          中文译稿 + 术语对照表
  02-accuracy.md             事实/引用/术语审查
  03-related.md              相关文献清单（WebFetch 核验过链接）
  04-visual.md               视觉规划 + SVG 源码
  05-explanation.md          ★ 最终中文讲解稿
```

## 依赖

- Claude Code CLI
- `pypdf` (Python, PDF 处理)
- `codex` CLI (可选, Codex 多样性视角)
- `xmllint` (可选, SVG 格式校验；通常随 `libxml2-utils` 提供)

## 参考文章库

将高质量技术文章放入 `examples/` 目录，审查和改写时会参考其风格和深度作为质量标杆。
