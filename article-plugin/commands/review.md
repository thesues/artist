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
| 1 | 准确性审查 | `agents/article-accuracy-checker.md` | opus | WebSearch |
| 2 | 内容审查 | `agents/article-content-reviewer.md` | opus | — |
| 2-codex | 内容审查（Codex） | `agents/article-content-reviewer-codex.md` | haiku+codex | Bash |
| 3 | 风格审计 | `agents/article-style-auditor.md` | opus | — |
| 4 | 视觉规划 | `agents/article-visual-planner.md` | sonnet | WebSearch |
| 5 | 审查聚合 | `agents/article-review-aggregator.md` | opus | — |

---

## 第一层 — 并行审查

**准备工作（启动 Agent 前）：**

- 若 `<origin>` 为 `.md`：创建 `.article-work/rewrite-round-1/` 目录，将原始文件拷贝为 `.article-work/rewrite-round-1/origin.md`
- 若 `<origin>` 为 `.pdf`：运行 PDF 预处理

在**单条消息中**同时启动 Agent 1/2/2-codex/3/4（并行），使用 `mode: "auto"`。

如果 `codex` CLI 不可用（`which codex` 失败），不启动 2-codex。

| Agent | 输入 | 输出 |
|-------|------|------|
| 1 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/01-accuracy.md` |
| 2 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/02-content.md` |
| 2-codex | `rewrite-round-1/origin.md` 全文 + 文件路径 + 输出路径 | `.article-work/rewrite-round-1/02-content-codex.md` |
| 3 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/03-style.md` |
| 4 | `rewrite-round-1/origin.md` 全文 + `../img/...` 图片（如存在） | `.article-work/rewrite-round-1/04-visual.md` |

---

## 第二层 — 聚合（等待第一层完成）

| Agent | 输入 | 输出 |
|-------|------|------|
| 5 | `01-accuracy.md` + `02-content.md` + `02-content-codex.md`（如存在） + `03-style.md` + `04-visual.md` | `.article-work/rewrite-round-1/05-review-report.md` |

---

## 输出

向用户展示 `.article-work/rewrite-round-1/05-review-report.md` 全文。

如需查看其他维度的审查结果，可查看 `.article-work/rewrite-round-1/` 目录中的其他文件。
