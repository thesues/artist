# /review — 技术文章快速审查

对技术文章进行多维度审查，输出综合审查报告。不做修改，不迭代。

## 用法

```
/review <origin.md 或 origin.pdf>
```

- `<origin>` — 必填。技术文章文件路径，支持 .md 和 .pdf 格式。
- PDF 文件先预处理为 `.article-work/origin.pdf`、`.article-work/img/` 和 `.article-work/rewrite-round-1/origin.md`。

## 执行规则

**所有 Agent 启动时必须设置 `mode: "auto"`**，确保 WebSearch 等工具不受权限阻塞。
**禁止对任何 Agent 使用 `run_in_background: true`**，所有 Agent 必须 foreground 运行。

中间状态写入 `.article-work/` 目录；其中轮次文件在 `.article-work/rewrite-round-1/`，PDF 原件和提取图片位于 `.article-work/` 根目录。

## PDF 输入预处理

若 `<origin>` 为 `.pdf`，先执行：

```bash
python "${CLAUDE_PLUGIN_ROOT}/skills/pdf/scripts/prepare_article_pdf.py" "<origin.pdf>" ".article-work"
```

固定生成：

- `.article-work/origin.pdf`
- `.article-work/img/fig_N.{jpg,png}`（从 PDF 中提取的嵌入图片）
- `.article-work/rewrite-round-1/origin.md`

`rewrite-round-1/origin.md` 必须满足：

- 每张嵌入图片对应 markdown 图片引用 `![fig_N](../img/fig_N.ext)`
- 所有图片引用统一使用 `../img/...`

后续调用各个第一层 Agent 时，如果 `origin.md` 中存在 `../img/...` 引用，调用方必须把这些图片作为多模态输入一并传入。

---

## Agent 定义

| 编号 | Agent | 文件 | 模型 | 工具 |
|------|-------|------|------|------|
| 1 | 事实校验 | `agents/article-fact-checker.md` | opus | WebSearch |
| 2 | 引用查找 | `agents/article-source-finder.md` | sonnet | WebSearch |
| 3 | 深度分析 | `agents/article-depth-analyzer.md` | opus | — |
| 3-codex | 深度分析（Codex） | `agents/article-depth-analyzer-codex.md` | haiku+codex | Bash |
| 4 | 逻辑审查 | `agents/article-logic-reviewer.md` | sonnet | — |
| 5 | 风格审计 | `agents/article-style-auditor.md` | opus | — |
| 6 | 术语检查 | `agents/article-terminology-checker.md` | sonnet | WebSearch |
| 7 | 结构分析 | `agents/article-structure-analyzer.md` | sonnet | — |
| 8 | 视觉规划 | `agents/article-visual-planner.md` | sonnet | WebSearch |
| 9 | 内容聚合 | `agents/article-content-aggregator.md` | opus | — |
| 10 | 审查聚合 | `agents/article-review-aggregator.md` | opus | — |

---

## 第一层 — 并行审查

**准备工作（启动 Agent 前）：**

- 若 `<origin>` 为 `.md`：创建 `.article-work/rewrite-round-1/` 目录，将原始文件拷贝为 `.article-work/rewrite-round-1/origin.md`
- 若 `<origin>` 为 `.pdf`：运行 PDF 预处理

在**单条消息中**同时启动 Agent 1/2/3/3-codex/4/5/6/7/8（并行），使用 `mode: "auto"`。

如果 `codex` CLI 不可用（`which codex` 失败），不启动 3-codex。

| Agent | 输入 | 输出 |
|-------|------|------|
| 1 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/01-facts.md` |
| 2 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/02-sources.md` |
| 3 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/03-depth-A.md` |
| 3-codex | `rewrite-round-1/origin.md` 全文 + 文件路径 + 输出路径 | `.article-work/rewrite-round-1/03-depth-A-codex.md` |
| 4 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/04-logic.md` |
| 5 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/05-style.md` |
| 6 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/06-terminology.md` |
| 7 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/07-structure.md` |
| 8 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/07-visual.md` |

---

## 第二层 — 内容聚合（等待第一层完成）

| Agent | 输入 | 输出 |
|-------|------|------|
| 9 | `03-depth-A.md` + `03-depth-A-codex.md`（如存在） + `04-logic.md` | `.article-work/rewrite-round-1/03-content.md` |

---

## 第三层 — 总聚合（等待第二层完成）

| Agent | 输入 | 输出 |
|-------|------|------|
| 10 | `01-facts.md` + `02-sources.md` + `03-content.md` + `05-style.md` + `06-terminology.md` + `07-structure.md` + `07-visual.md` | `.article-work/rewrite-round-1/08-review-report.md` |

---

## 输出

向用户展示 `.article-work/rewrite-round-1/08-review-report.md` 全文。

如需查看其他维度的审查结果，可查看 `.article-work/rewrite-round-1/` 目录中的其他文件。
