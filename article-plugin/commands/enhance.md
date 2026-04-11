# /enhance — 技术文章审查与增强

对技术文章进行多维度审查，自动改写增强并验证，最终输出审查通过的修改稿。

## 用法

```
/enhance <origin.md 或 origin.pdf>
```

- `<origin>` — 必填。技术文章文件路径，支持 .md 和 .pdf 格式。
- PDF 文件先预处理为 `.article-work/origin.pdf`、`.article-work/img/` 和 `.article-work/rewrite-round-1/origin.md`。

## 执行规则

**必须按顺序执行以下 5 层，每层完成后等待依赖层结果再继续。**
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

后续所有 `rewrite-round-N/origin.md` 和 `rewrite-round-N/09-revised-origin.md` 必须继续保留这些 `../img/...` 引用。

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
| 11 | 图表渲染 | `agents/article-diagram-renderer.md` | sonnet | Bash |
| 12 | 截图采集 | `agents/article-screenshot-capturer.md` | sonnet | MCP Chrome |
| 13 | 迭代改写 | `agents/article-rewriter.md` | opus | WebSearch, AskUserQuestion |

---

## 第一层 — 并行审查（最多 9 个 Agent 同时启动）

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

## 第二层 — 聚合（等待第一层完成）

同时启动 Agent 9/10（并行），使用 `mode: "auto"`：

| Agent | 输入 | 输出 |
|-------|------|------|
| 9 | `03-depth-A.md` + `03-depth-A-codex.md`（如存在） + `04-logic.md` | `.article-work/rewrite-round-1/03-content.md` |

等待 Agent 9 完成后启动 Agent 10：

| Agent | 输入 | 输出 |
|-------|------|------|
| 10 | `01-facts.md` + `02-sources.md` + `03-content.md` + `05-style.md` + `06-terminology.md` + `07-structure.md` + `07-visual.md` | `.article-work/rewrite-round-1/08-review-report.md` |

---

## 第三层 — 图示执行（等待第二层完成，与第四层可并行）

如果 `07-visual.md` 中有需要渲染的 Mermaid 图示或需要截图的 URL：

| Agent | 输入 | 输出 |
|-------|------|------|
| 11 | `07-visual.md` 中的 Mermaid 代码 | `.article-work/img/diagram_N.png` |
| 12 | `07-visual.md` 中的截图 URL | `.article-work/img/screenshot_N.png` |

如果无图示需求，跳过本层。

---

## 第四层 — 首次改写 + 验证循环（等待第二层完成）

```
步骤 1（仅一次）：
Agent 13 读 rewrite-round-1/origin.md + rewrite-round-1/08-review-report.md + ../img/... 图片
  → 输出 rewrite-round-1/09-revised-origin.md + rewrite-round-1/09-revision-notes.md

步骤 2（验证循环，N 从 2 开始）：
┌─→ 准备：拷贝 rewrite-round-{N-1}/09-revised-origin.md → rewrite-round-{N}/origin.md
│         │
│         ▼
│   Agent 3/4/5 并行验证 rewrite-round-{N}/origin.md
│         │
│         ▼
│   Agent 9 聚合 → rewrite-round-{N}/03-content.md
│         │
│   有 🔴 且 N<4？──是──→ Agent 13 修改
│         │                → rewrite-round-{N}/09-revised-origin.md + 09-revision-notes.md
│         │                                         │
│        否 / N=4                                  N++ ──────┘
│         ▼
│   输出最终修改稿
```

### 步骤 1 — Agent 13 首次改写（输出写入 rewrite-round-1/）

| 输入 | 输出 |
|------|------|
| `rewrite-round-1/origin.md` + `../img/...` 图片 + `08-review-report.md` | `rewrite-round-1/09-revised-origin.md` + `rewrite-round-1/09-revision-notes.md` |

### 步骤 2 — 验证循环（N 从 2 开始）

**准备：** 创建 `rewrite-round-{N}/` 目录，拷贝 `rewrite-round-{N-1}/09-revised-origin.md` → `rewrite-round-{N}/origin.md`。

**验证：** 并行启动 Agent 3/4/5，输入为 `rewrite-round-{N}/origin.md` + `../img/...` 图片，输出到：
- `rewrite-round-{N}/03-depth-A.md`
- `rewrite-round-{N}/04-logic.md`
- `rewrite-round-{N}/05-style.md`

等待完成后启动 Agent 9，输出到 `rewrite-round-{N}/03-content.md`。

**判断退出条件：**

- `03-content.md` 无 🔴 → 退出循环，最终修改稿 = `rewrite-round-{N}/origin.md`
- 有 🔴 且 N < 4 → Agent 13 读 `rewrite-round-{N}/origin.md` + `../img/...` 图片 + `03-content.md`，输出 `09-revised-origin.md` + `09-revision-notes.md`，N++
- N = 4 且仍有 🔴 → 强制退出，标注未解决的问题

### 循环结束 — 输出最终结果

设最后一轮为 `rewrite-round-{last_N}/`。

向用户展示：
1. `rewrite-round-{last_N}/origin.md` — 最终修改后的文章
2. `rewrite-round-{last_N}/09-revision-notes.md` — 本轮修改说明（如存在）
3. `rewrite-round-{last_N}/03-content.md` — 最终内容验证结果

**告知用户：** 修改稿涉及事实修正、深度扩写、逻辑优化和去 AI 味改写。用户应审阅修改内容，确认后可用于发布。

---

## 中间文件清单

```
.article-work/
  origin.pdf                 用户原始 PDF 拷贝（仅 PDF 输入存在）
  img/                       图片目录（PDF 提取图 + Mermaid 渲染图 + 截图）
    fig_1.jpg                PDF 提取图
    diagram_1.png            Mermaid 渲染图
    screenshot_1.png         网页截图
  00-examples-reference.md   参考文章风格摘要（如有参考文章库）
  .codex-prompt-depth.md     Codex prompt 临时文件
  rewrite-round-1/           第1轮（初始审查 + 首次改写）
    origin.md                第一层统一输入
    01-facts.md              事实校验结果
    02-sources.md            引用查找结果
    03-depth-A.md            深度分析（opus）
    03-depth-A-codex.md      深度分析（codex，可选）
    03-content.md            内容聚合结果
    04-logic.md              逻辑审查结果
    05-style.md              风格审计结果
    06-terminology.md        术语检查结果
    07-structure.md          结构分析结果
    07-visual.md             视觉规划结果
    08-review-report.md      综合审查报告
    09-revised-origin.md     首次改写后的文章
    09-revision-notes.md     首次改写说明
  rewrite-round-2/           第2轮验证
    origin.md                本轮输入（= round-1/09-revised-origin.md 的拷贝）
    03-depth-A.md            深度验证
    04-logic.md              逻辑验证
    05-style.md              风格验证
    03-content.md            聚合验证结果
    09-revised-origin.md     本轮改写（如有 🔴）
    09-revision-notes.md     本轮改写说明（如有 🔴）
  rewrite-round-3/           第3轮（如有）
  rewrite-round-4/           第4轮（最多到此，仅验证不再改写）
```

---

## 中断恢复（--resume）

如果用户运行 `/enhance --resume`，读取 `.article-work/` 中已存在的文件，判断恢复点：

1. 若输入为 PDF，`.article-work/origin.pdf` 或 `rewrite-round-1/origin.md` 缺失 → 重跑 PDF 预处理
2. `rewrite-round-1/` 不存在或第一层文件不全 → 重跑第一层
3. 第一层完整但 `03-content.md` 不存在 → 从第二层内容聚合开始
4. `03-content.md` 存在但 `08-review-report.md` 不存在 → 从总聚合开始
5. `08-review-report.md` 存在但 `09-revised-origin.md` 不存在 → 从首次改写开始
6. `09-revised-origin.md` 存在但无 `rewrite-round-2/` → 从验证循环 N=2 开始
7. 存在 `rewrite-round-N/`（N≥2）→ 找到最大 N，按状态恢复
