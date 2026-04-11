# Article Enhancement Plugin

技术调研文章多维度审查与增强插件。通过 8 个专业 Agent 协同工作，对技术文章进行事实校验、深度分析、逻辑审查、去 AI 味、术语规范化等多维度增强。

## 架构

```
第一层：并行分析（最多 5 个 Agent）
├── article-accuracy-checker         opus    事实+引用+术语 + WebSearch
├── article-content-reviewer         opus    深度+逻辑+结构
├── article-content-reviewer-codex   haiku   Codex 多样性视角（可选）
├── article-style-auditor            opus    去 AI 味核心
└── article-visual-planner           sonnet  视觉规划 + WebSearch

第二层：聚合
└── article-review-aggregator        opus    汇总全部报告 + 交叉验证

图示渲染
└── article-diagram-renderer         sonnet  Mermaid 渲染

迭代改写
└── article-rewriter                 opus    根据报告逐条修改 + 用户交互
    └── 每轮修改后重跑 content-reviewer + style-auditor + aggregator
    └── 循环直到无 🔴 严重问题，最多 3 轮
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

## 支持的输入格式

- **Markdown (.md)** — 直接处理
- **PDF (.pdf)** — 自动预处理为 Markdown + 提取嵌入图片

## 中间文件

所有中间状态写入 `.article-work/` 目录：

```
.article-work/
  origin.pdf                 PDF 原件（仅 PDF 输入）
  img/                       图片目录
    fig_N.{jpg,png}          PDF 提取图
    diagram_N.png            Mermaid 渲染图
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

## 依赖

- Claude Code CLI
- `pypdf` (Python, PDF 处理)
- `codex` CLI (可选, Codex 多样性视角)
- `mmdc` / `@mermaid-js/mermaid-cli` (可选, 图表渲染)

## 参考文章库

将高质量技术文章放入 `examples/` 目录，审查和改写时会参考其风格和深度作为质量标杆。
