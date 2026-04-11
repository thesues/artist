# /enhance — 技术文章审查与增强

对技术文章进行多维度审查，自动改写增强并验证，最终输出审查通过的修改稿。

## 用法

```
/enhance <origin.md 或 origin.pdf>
```

- `<origin>` — 必填。技术文章文件路径，支持 .md 和 .pdf 格式。
- PDF 文件先预处理为 `.article-work/origin.pdf`、`.article-work/img/` 和 `.article-work/rewrite-round-1/origin.md`。

## 进度追踪

**启动任何 Agent 之前，必须先用 TaskCreate 创建任务清单，让用户能看到整体进度。**

任务清单必须至少覆盖以下阶段（任务名称和粒度由你决定）：
- 第一层并行审查
- 第二层聚合
- 图示渲染
- 改写与验证循环

每个任务在开始时标记为 in_progress，完成后标记为 completed。对于改写与验证循环，通过 TaskUpdate 更新任务描述来反映当前轮次进展（如当前第几轮、是否通过验证等）。

## 执行规则

**必须按顺序执行以下层级，每层完成后等待依赖层结果再继续。**
禁止跳层、禁止合并层级。

**所有 Agent 启动时必须设置 `mode: "auto"`**，确保 WebSearch 等工具不受权限阻塞。
**禁止对任何 Agent 使用 `run_in_background: true`**，所有 Agent 必须 foreground 运行。

中间状态写入 `.article-work/` 目录；其中 PDF 原件和提取图片位于根目录，轮次文件位于 `rewrite-round-N/`。

如果 `.article-work/` 已存在且包含文件，提示用户是否 `--resume` 从中断处继续。

## PDF 输入预处理

若 `<origin>` 为 `.pdf`，先执行：

```bash
python "${CLAUDE_PLUGIN_ROOT}/skills/pdf/scripts/prepare_article_pdf.py" "<origin.pdf>" ".article-work"
```

固定生成：

- `.article-work/origin.pdf`
- `.article-work/img/fig_N.{jpg,png}`（从 PDF 中提取的嵌入图片）
- `.article-work/rewrite-round-1/origin.md`

后续所有 `rewrite-round-N/origin.md` 和 `rewrite-round-N/06-revised-origin.md` 必须继续保留这些 `../img/...` 引用。

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
| 6 | 图表渲染 | `agents/article-diagram-renderer.md` | sonnet | Bash |
| 7 | 迭代改写 | `agents/article-rewriter.md` | opus | WebSearch, AskUserQuestion |

---

## 第一层 — 并行审查（最多 5 个 Agent 同时启动）

**准备工作（启动 Agent 前）：**

- 若 `<origin>` 为 `.md`：创建 `.article-work/rewrite-round-1/` 目录，将原始文件拷贝为 `.article-work/rewrite-round-1/origin.md`
- 若 `<origin>` 为 `.pdf`：运行 PDF 预处理

在**单条消息中**同时启动 Agent 1/2/2-codex/3/4（并行），使用 `mode: "auto"`。

**Codex 可用性检查（启动 Agent 前执行）：** 依次运行以下两个命令，任一失败则跳过 2-codex：
1. `which codex` — 检查 codex CLI 是否安装
2. `codex login status` — 检查是否已登录（输出 "Logged in" 表示可用）

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

## 图示渲染（等待第二层完成，必须在改写前完成）

如果 `04-visual.md` 中有需要渲染的 Mermaid 图示：

| Agent | 输入 | 输出 |
|-------|------|------|
| 6 | `04-visual.md` 中的 Mermaid 代码 | `.article-work/img/diagram_N.png` |

如果无图示需求，跳过本步骤。

**必须等待图示渲染完成后再启动改写。** Rewriter 需要知道哪些图已渲染，才能将它们插入到正确位置。

---

## 改写 + 验证循环（等待第二层和图示渲染完成）

```
步骤 1（仅一次）：
Agent 7 读 rewrite-round-1/origin.md + rewrite-round-1/05-review-report.md + ../img/... 图片（含 diagram_N.png）
  → 输出 rewrite-round-1/06-revised-origin.md + rewrite-round-1/06-revision-notes.md

步骤 2（验证循环，N 从 2 开始）：
┌─→ 准备：拷贝 rewrite-round-{N-1}/06-revised-origin.md → rewrite-round-{N}/origin.md
│         │
│         ▼
│   Agent 2/3 并行验证 rewrite-round-{N}/origin.md
│         │
│         ▼
│   Agent 5 聚合 → rewrite-round-{N}/05-review-report.md
│         │
│   有 🔴 且 N<4？──是──→ Agent 7 修改
│         │                → rewrite-round-{N}/06-revised-origin.md + 06-revision-notes.md
│         │                                         │
│        否 / N=4                                  N++ ──────┘
│         ▼
│   输出最终修改稿
```

### 步骤 1 — Agent 7 首次改写（输出写入 rewrite-round-1/）

| 输入 | 输出 |
|------|------|
| `rewrite-round-1/origin.md` + `../img/...` 图片（含已渲染的 `diagram_N.png`） + `05-review-report.md` | `rewrite-round-1/06-revised-origin.md` + `rewrite-round-1/06-revision-notes.md` |

**启动 Agent 7 时，prompt 必须包含以下信息：**
- `../img/` 目录下所有已渲染的 `diagram_N.png` 文件列表
- `04-visual.md` 或 `05-review-report.md` 中对应的图示插入位置建议（图示名称 → 建议插入的章节）
- 明确指令：将渲染好的 Mermaid 图示以 `![图示说明](../img/diagram_N.png)` 格式插入到对应位置

### 步骤 2 — 验证循环（N 从 2 开始）

**准备：** 创建 `rewrite-round-{N}/` 目录，拷贝 `rewrite-round-{N-1}/06-revised-origin.md` → `rewrite-round-{N}/origin.md`。

**验证：** 并行启动 Agent 2/3，输入为 `rewrite-round-{N}/origin.md` + `../img/...` 图片，输出到：
- `rewrite-round-{N}/02-content.md`
- `rewrite-round-{N}/03-style.md`

等待完成后启动 Agent 5 聚合，输出到 `rewrite-round-{N}/05-review-report.md`。

**判断退出条件：**

- `05-review-report.md` 无 🔴 → 退出循环，最终修改稿 = `rewrite-round-{N}/origin.md`
- 有 🔴 且 N < 4 → Agent 7 读 `rewrite-round-{N}/origin.md` + `../img/...` 图片（含 `diagram_N.png`） + `05-review-report.md`，输出 `06-revised-origin.md` + `06-revision-notes.md`，N++
- N = 4 且仍有 🔴 → 强制退出，标注未解决的问题

### 循环结束 — 输出最终结果

设最后一轮为 `rewrite-round-{last_N}/`。

向用户展示：
1. `rewrite-round-{last_N}/origin.md` — 最终修改后的文章
2. `rewrite-round-{last_N}/06-revision-notes.md` — 本轮修改说明（如存在）
3. `rewrite-round-{last_N}/05-review-report.md` — 最终内容验证结果

**告知用户：** 修改稿涉及事实修正、深度扩写、逻辑优化和去 AI 味改写。用户应审阅修改内容，确认后可用于发布。

---

## 中间文件清单

```
.article-work/
  origin.pdf                 用户原始 PDF 拷贝（仅 PDF 输入存在）
  img/                       图片目录（PDF 提取图 + Mermaid 渲染图）
    fig_1.jpg                PDF 提取图
    diagram_1.png            Mermaid 渲染图
  00-examples-reference.md   参考文章风格摘要（如有参考文章库）
  .codex-prompt-content.md   Codex prompt 临时文件
  rewrite-round-1/           第1轮（初始审查 + 首次改写）
    origin.md                第一层统一输入
    01-accuracy.md           准确性审查结果（事实+引用+术语）
    02-content.md            内容审查结果（深度+逻辑+结构）
    02-content-codex.md      内容审查 Codex 结果（可选）
    03-style.md              风格审计结果
    04-visual.md             视觉规划结果
    05-review-report.md      综合审查报告
    06-revised-origin.md     首次改写后的文章
    06-revision-notes.md     首次改写说明
  rewrite-round-2/           第2轮验证
    origin.md                本轮输入（= round-1/06-revised-origin.md 的拷贝）
    02-content.md            内容验证
    03-style.md              风格验证
    05-review-report.md      聚合验证结果
    06-revised-origin.md     本轮改写（如有 🔴）
    06-revision-notes.md     本轮改写说明（如有 🔴）
  rewrite-round-3/           第3轮（如有）
  rewrite-round-4/           第4轮（最多到此，仅验证不再改写）
```

---

## 中断恢复（--resume）

如果用户运行 `/enhance --resume`，读取 `.article-work/` 中已存在的文件，判断恢复点：

1. 若输入为 PDF，`.article-work/origin.pdf` 或 `rewrite-round-1/origin.md` 缺失 → 重跑 PDF 预处理
2. `rewrite-round-1/` 不存在或第一层文件不全 → 重跑第一层
3. 第一层完整但 `05-review-report.md` 不存在 → 从聚合开始
4. `05-review-report.md` 存在但 `06-revised-origin.md` 不存在 → 从首次改写开始
5. `06-revised-origin.md` 存在但无 `rewrite-round-2/` → 从验证循环 N=2 开始
6. 存在 `rewrite-round-N/`（N≥2）→ 找到最大 N，按状态恢复
