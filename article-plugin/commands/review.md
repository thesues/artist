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
- `.article-work/img/fig_N.png`（从 PDF 渲染的 figure，一张 figure 一份；多 tile 自动合并）
- `.article-work/rewrite-round-1/origin.md`

`rewrite-round-1/origin.md` 必须满足：

- 每张 figure 对应 markdown 图片引用 `![fig_N](../img/fig_N.png)`
- 所有图片引用统一使用 `../img/...`

后续调用各个第一层 Agent 时，**只在 prompt 中传入文件路径**（`origin.md` 与图片目录），由 agent 自行 `Read` 文件内容；调用方不要把 `origin.md` 全文或图片以多模态形式嵌入 prompt（否则父协调层会持有多份副本，token 急剧放大）。

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

**调用约定（重要）**：每个 Agent 的 prompt 仅给出"输入文件路径 + 图片目录路径 + 输出文件路径"三类信息；不要把 `origin.md` 内容粘进 prompt，也不要把 `../img/*.png` 以多模态 image block 形式塞进 prompt。Agent 启动后用 `Read` 工具按需加载。

| Agent | 输入 | 输出 |
|-------|------|------|
| 1 | 路径：`.article-work/rewrite-round-1/origin.md`；图片目录：`.article-work/img/`（按需 Read 对应 `fig_N.png`） | `.article-work/rewrite-round-1/01-accuracy.md` |
| 2 | 路径：`.article-work/rewrite-round-1/origin.md`；图片目录：`.article-work/img/`（按需 Read） | `.article-work/rewrite-round-1/02-content.md` |
| 2-codex | 路径：`.article-work/rewrite-round-1/origin.md`；输出路径作为 `--output-file` 传入 codex-task.mjs | `.article-work/rewrite-round-1/02-content-codex.md` |
| 3 | 路径：`.article-work/rewrite-round-1/origin.md`；图片目录：`.article-work/img/`（按需 Read） | `.article-work/rewrite-round-1/03-style.md` |
| 4 | 路径：`.article-work/rewrite-round-1/origin.md`；图片目录：`.article-work/img/`（按需 Read） | `.article-work/rewrite-round-1/04-visual.md` |

---

## 第二层 — 聚合（等待第一层完成）

| Agent | 输入 | 输出 |
|-------|------|------|
| 5 | `01-accuracy.md` + `02-content.md` + `02-content-codex.md`（如存在） + `03-style.md` + `04-visual.md` | `.article-work/rewrite-round-1/05-review-report.md` |

---

## 输出

向用户展示 `.article-work/rewrite-round-1/05-review-report.md` 全文。

如需查看其他维度的审查结果，可查看 `.article-work/rewrite-round-1/` 目录中的其他文件。
