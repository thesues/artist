# /explain — 英文论文/技术文章中文讲解

把一篇英文论文或网页技术文章翻译为高质量中文，结合事实校验、相关文献检索、SVG 图示，生成可直接发布的中文讲解稿。**单轮成稿，不做多轮迭代**。

## 用法

```
/explain <英文文章路径或 URL>
```

支持的输入：

- `<URL>` — 任意 https URL（论文 abs 页、博客、官方文档等）
- `<file.pdf>` — 英文论文 PDF
- `<file.md>` — 英文 markdown

输出：
- `.article-work-explain/05-explanation.md` — 最终中文讲解稿
- `.article-work-explain/img/diagram_N.svg` — 自动生成的图示
- 其余中间文件见下文清单

## 进度追踪

**启动任何 Agent 之前，必须先用 TaskCreate 创建任务清单，让用户能看到整体进度。**

任务清单至少覆盖：
- 输入预处理（URL / PDF / MD）
- 第一层并行（翻译、事实校验、相关检索、视觉规划）
- 图示落盘
- 第二层合成（讲解稿）

每个任务在开始时标记为 `in_progress`，完成后标记为 `completed`。

## 执行规则

**所有 Agent 启动时必须设置 `mode: "auto"`**，确保 WebSearch / WebFetch 不被权限阻塞。
**禁止对任何 Agent 使用 `run_in_background: true`**，所有 Agent 必须 foreground 运行。

中间状态写入 `.article-work-explain/` 目录（独立于 `.article-work/`，互不干扰）。

如果 `.article-work-explain/` 已存在且包含文件，提示用户是否 `--resume` 从中断处继续；详见末尾"中断恢复"。

---

## 输入预处理

根据 `<input>` 的类型，统一产出 `.article-work-explain/source/origin.md`（英文 markdown）+ `.article-work-explain/img/`（可选图片目录）。

### 情况 A：URL 输入

```
.article-work-explain/source/origin.url   纯文本，存放原始 URL
.article-work-explain/source/origin.md    抓取后的 markdown
```

执行步骤：

1. 创建目录 `.article-work-explain/source/` 与 `.article-work-explain/img/`
2. 把 URL 写入 `.article-work-explain/source/origin.url`
3. 用 WebFetch 抓取该 URL，提示词为：
   - "Extract the full article content as markdown. Preserve headings, lists, tables, code blocks. Drop navigation, ads, comments, related-articles widgets. Return raw markdown only."
4. 把返回内容写入 `.article-work-explain/source/origin.md`
5. 在 `origin.md` 顶部插入元信息（不计入正文）：
   ```markdown
   <!-- source-url: <原 URL> -->
   <!-- fetched-at: <ISO 时间戳> -->
   ```

如果 URL 是 arXiv `abs/` 链接，**优先抓取 abs 页拿到摘要 + 元数据**；同时把 PDF 链接写入 `origin.url` 末尾备注。如需正文全文，提示用户改用 `/explain <PDF 文件路径>`。

### 情况 B：PDF 输入

```bash
python "${CLAUDE_PLUGIN_ROOT}/skills/pdf/scripts/prepare_article_pdf.py" "<input.pdf>" ".article-work-explain"
```

脚本会生成：

- `.article-work-explain/origin.pdf`
- `.article-work-explain/img/fig_N.png`（从 PDF 渲染的 figure，一张 figure 一份；多 tile 自动合并）
- `.article-work-explain/rewrite-round-1/origin.md`（脚本既定输出位置）

预处理后立刻执行：

```bash
mkdir -p .article-work-explain/source
mv .article-work-explain/rewrite-round-1/origin.md .article-work-explain/source/origin.md
rmdir .article-work-explain/rewrite-round-1
mv .article-work-explain/origin.pdf .article-work-explain/source/origin.pdf
```

`origin.md` 中的 `../img/...` 引用对 `source/` 与 `rewrite-round-1/` 同样有效（都解析到 `.article-work-explain/img/`），无需重写路径。

### 情况 C：Markdown 输入

```bash
mkdir -p .article-work-explain/source .article-work-explain/img
cp <input.md> .article-work-explain/source/origin.md
```

如果 `<input.md>` 同目录下有 `img/` 或它引用的本地图片，**一并拷贝**到 `.article-work-explain/img/`，并按需修正 `origin.md` 的图片路径为 `../img/...`。

---

## Agent 定义

| 编号 | Agent | 文件 | 模型 | 工具 |
|------|-------|------|------|------|
| 1 | 翻译 | `agents/article-translator.md` | opus | WebSearch |
| 2 | 准确性审查 | `agents/article-accuracy-checker.md` | opus | WebSearch |
| 3 | 相关文章检索 | `agents/article-related-finder.md` | sonnet | WebSearch, WebFetch |
| 4 | 视觉规划 | `agents/article-visual-planner.md` | sonnet | WebSearch |
| 5 | 图示落盘 | `agents/article-diagram-renderer.md` | sonnet | Read, Write, Grep, Glob, Bash |
| 6 | 讲解合成 | `agents/article-explainer.md` | opus | WebSearch, WebFetch |

---

## 第一层 — 并行（4 个 Agent，单条消息同时启动）

输入文件 `source/origin.md`，所有 Agent 共用。如果 `origin.md` 中存在 `../img/...` 引用，调用方必须把这些图片作为多模态输入一并传入。

| Agent | 输入 | 输出 |
|-------|------|------|
| 1 translator | `source/origin.md` 全文 + `../img/...` 图片 | `.article-work-explain/01-translation.md` |
| 2 accuracy-checker | `source/origin.md` 全文 + `../img/...` 图片 | `.article-work-explain/02-accuracy.md` |
| 3 related-finder | `source/origin.md` 全文 + `../img/...` 图片 | `.article-work-explain/03-related.md` |
| 4 visual-planner | `source/origin.md` 全文 + `../img/...` 图片 | `.article-work-explain/04-visual.md` |

启动 Agent 时显式指定输入文件路径与输出文件路径。

---

## 图示落盘（等待第一层完成）

如果 `04-visual.md` 中存在 ```svg 代码块：

| Agent | 输入 | 输出 |
|-------|------|------|
| 5 diagram-renderer | `04-visual.md` | `.article-work-explain/img/diagram_N.svg` |

**调用 renderer 时必须明确指定输出目录为 `.article-work-explain/img/`**（默认是 `.article-work/img/`，要覆盖）。可在 prompt 中写明：

> "把 SVG 代码块落盘到 `.article-work-explain/img/diagram_N.svg`，输入报告路径为 `.article-work-explain/04-visual.md`。"

如果 `04-visual.md` 没有 SVG 代码块，跳过本步骤。

**必须等待落盘完成后再启动 explainer。**

---

## 第二层 — 讲解合成

| Agent | 输入 | 输出 |
|-------|------|------|
| 6 explainer | `01-translation.md` + `02-accuracy.md` + `03-related.md` + `04-visual.md` + `source/origin.md` + `img/diagram_N.svg` + `img/fig_N.png` | `.article-work-explain/05-explanation.md` |

启动 explainer 时 prompt 必须包含：

- 全部 6 类输入文件的完整路径
- `img/` 目录下所有 `diagram_N.svg` 文件清单与对应的 `04-visual.md` 中"建议插入位置"
- 明确指令：图示以 `![图示标题](img/diagram_N.svg)` 插入；最终输出写到 `.article-work-explain/05-explanation.md`
  - **路径说明**：`05-explanation.md` 与 `img/` 同级位于 `.article-work-explain/` 根目录，因此用 `img/diagram_N.svg`（相对路径，不带 `../`）。`source/origin.md` 中的 `../img/...` 引用是相对 `source/` 子目录，不要照搬到 `05-explanation.md`。
- 若 `origin.md` 中带有 `../img/fig_N.png`（PDF 渲染或本地图片），写入 `05-explanation.md` 时同样改写为 `img/fig_N.png`

**explainer 单次运行成稿，不做多轮迭代。**

---

## 输出

向用户展示：

1. `.article-work-explain/05-explanation.md` — 最终中文讲解稿
2. `.article-work-explain/img/` — 所有图示文件清单
3. （可选）告知用户：如对某段译文不满意，可手动编辑 `05-explanation.md` 或重跑 `/explain --resume`（仅会刷新 explainer 一步）

---

## 中间文件清单

```
.article-work-explain/
  source/
    origin.md             英文原文（统一形态）
    origin.pdf            PDF 输入时保留
    origin.url            URL 输入时保留
  img/
    fig_N.png             PDF 渲染图（一张 figure 一份；仅 PDF 输入）
    diagram_N.svg         visual-planner 生成的图示
  01-translation.md       中文译稿 + 术语表
  02-accuracy.md          事实/引用/术语审查
  03-related.md           延伸阅读清单（核验过 URL）
  04-visual.md            视觉规划 + SVG 源码
  05-explanation.md       ★ 最终中文讲解稿
```

---

## 中断恢复（--resume）

`/explain --resume`：读取 `.article-work-explain/` 中已存在的文件，按状态恢复：

1. `source/origin.md` 不存在 → 重跑输入预处理
2. `source/origin.md` 存在但第一层 4 份输出不全 → 仅重跑缺失的第一层 Agent（**保留已完成的输出**）
3. 第一层完整但 `04-visual.md` 中有 SVG 代码块且 `img/diagram_*.svg` 缺失 → 重跑 renderer
4. 全部就绪但 `05-explanation.md` 不存在 → 仅重跑 explainer
5. `05-explanation.md` 存在但用户希望刷新 → 询问是否覆盖

恢复时不要清空 `.article-work-explain/`；如确实需要重置，明确询问用户。

---

## 注意事项

- 输入通常是英文，但 Agent 链路对中文输入也兼容（translator 会识别并直接输出"无需翻译"）。这种情况下建议改用 `/review` 或 `/enhance`
- 对于体量很大的论文（>30 页），建议先用 PDF 预处理拆出正文，再决定是否需要分段调用
- WebSearch/WebFetch 调用会消耗较多时间，整个流程典型耗时 5–15 分钟
- 输出讲解稿默认保留译稿与图示路径 `../img/...`；如需把成稿单独发布，请连同 `.article-work-explain/img/` 一起搬运
