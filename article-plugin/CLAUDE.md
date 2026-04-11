# Article Plugin — 技术调研文章增强

## 功能定位
对技术调研文章进行多维度审查、内容扩充、事实校验、风格去 AI 化，并支持多轮迭代改写。

## 架构
两层 Agent 工作流 + 图示渲染 + 迭代改写：

### 第一层：并行分析（最多 5 个 Agent）
- `article-accuracy-checker` — opus, WebSearch, 事实验证+引用查找+术语检查
- `article-content-reviewer` — opus, 技术深度+论证逻辑+章节结构
- `article-content-reviewer-codex` — haiku+codex, 内容审查的 Codex 多样性视角（可选，需 codex CLI）
- `article-style-auditor` — opus, 去 AI 味核心 Agent，检测模板化表达
- `article-visual-planner` — sonnet, WebSearch, 规划图示、截取参考图

### 第二层：聚合（1 个 Agent）
- `article-review-aggregator` — opus, 汇总全部报告，交叉验证（含 Codex 视角），生成统一审查报告

### 图示渲染（1 个 Agent，必须在改写前完成）
- `article-diagram-renderer` — sonnet, Bash, 用 Mermaid 渲染流程图/架构图，渲染结果供 rewriter 插入文章

### 迭代改写与验证循环（1 个 Agent + 验证回路）
- `article-rewriter` — opus, AskUserQuestion, 根据审查报告逐条修改
- 每轮修改后重跑 content-reviewer + style-auditor + review-aggregator
- 循环直到无 🔴 严重问题，最多 3 轮
- 每轮过程文件写入独立目录 `rewrite-round-N/`

## 命令
- `/review <file>` — 快速审查，不修改（commands/review.md）
- `/enhance <file>` — 完整增强，含迭代改写（commands/enhance.md）

## 中间文件
- 所有中间状态写入 `.article-work/` 目录
- PDF 输入时，`.article-work/origin.pdf` 保留原始文件，`.article-work/img/` 保留提取图片
- 各轮次文件在 `.article-work/rewrite-round-N/`
- 文件命名约定：01-accuracy, 02-content, 02-content-codex, 03-style, 04-visual, 05-review-report, 06-revised-origin, 06-revision-notes

## PDF 输入
- `.pdf` 输入先预处理为 `origin.pdf + img/ + rewrite-round-1/origin.md`
- 从 PDF 提取嵌入图片，保存为 `img/fig_N.{jpg,png}`
- `rewrite-round-1/origin.md` 中图片以 `![fig_N](../img/fig_N.ext)` 引用

## Codex 集成
- `scripts/codex-task.mjs` — 精简版 Codex 运行时
- Codex agent 是 haiku 转发器：读文章 → 组装 prompt → 调用 codex-task.mjs → 写入结果
- 需要 `codex` CLI 已安装，不可用时自动跳过

## Skills
- `article-examples` — 参考文章库（examples/ 目录）
- `pdf` — PDF 读取和处理

## Agent 文件格式
使用 YAML frontmatter：`name`, `description`, `tools`, `model`。
