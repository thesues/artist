# Article Enhancement Plugin — Feature List

## F01: 项目骨架与插件目录结构
- 目标：创建 article-plugin/ 目录结构（agents/, commands/, scripts/, skills/）+ CLAUDE.md
- 验收：目录结构与 patent-plugin 一致，CLAUDE.md 描述完整架构
- passes: true

## F02: codex-task.mjs 脚本
- 目标：从 patent-plugin 复制并适配 codex-task.mjs，修改 serviceName
- 验收：脚本可独立运行（`node scripts/codex-task.mjs --help` 不报错）
- passes: true

## F03: Agent — article-accuracy-checker (opus + WebSearch)
- 目标：事实验证+引用查找+术语检查三合一（合并原 fact-checker + source-finder + terminology-checker）
- 验收：agent md 文件格式正确，包含三个审查维度
- passes: true

## F04: Agent — article-content-reviewer (opus)
- 目标：技术深度+论证逻辑+章节结构三合一（合并原 depth-analyzer + logic-reviewer + structure-analyzer）
- 验收：agent md 文件格式正确，包含三个审查维度
- passes: true

## F05: Agent — article-content-reviewer-codex (haiku + codex)
- 目标：内容审查的 Codex 多样性视角，覆盖深度+逻辑+结构
- 验收：agent md 文件格式正确，Codex prompt 覆盖三个维度
- passes: true

## F06: Agent — article-style-auditor (opus) — 去 AI 味核心
- 目标：检测 AI 写作痕迹，建议自然人类表达替换
- 验收：agent md 文件格式正确，包含详细的 AI 味检测规则
- passes: true

## F07: Agent — article-visual-planner (sonnet + WebSearch)
- 目标：规划流程图/架构图，搜索参考图示
- 验收：agent md 文件格式正确
- passes: true

## F08: Agent — article-review-aggregator (opus)
- 目标：汇总全部 Agent 报告，交叉验证（含 Codex 视角），生成统一审查报告
- 验收：agent md 文件格式正确，直接读取 5 份第一层报告
- passes: true

## F09: Agent — article-diagram-renderer (sonnet + Bash)
- 目标：用 Mermaid 渲染流程图/架构图/时序图
- 验收：agent md 文件格式正确，包含 mmdc 渲染命令
- passes: true
- 备注：已在 F15 被 SVG 链路替代

## F10: Agent — article-rewriter (opus + AskUserQuestion)
- 目标：根据审查报告逐条修改，支持多轮迭代，与用户交互确认
- 验收：agent md 文件格式正确，包含 AskUserQuestion 使用场景定义
- passes: true

## F11: Command — /review（快速审查，不修改）
- 目标：对文章进行多维度审查，输出审查报告
- 验收：command md 文件完整，定义两层 Agent 调度流程
- passes: true

## F12: Command — /enhance（完整增强，含迭代改写）
- 目标：审查 + 图示生成 + 多轮迭代改写的完整流程
- 验收：command md 文件完整，包含迭代回路逻辑和中断恢复
- passes: true

## F13: PDF 输入预处理 Skill
- 目标：PDF → origin.md + img/ 提取流程
- 验收：skill 目录结构完整，prepare_article_pdf.py 脚本可用
- passes: true

## F14: 集成验证与 README
- 目标：端到端测试 /review 和 /enhance 命令，更新 README
- 验收：README 包含完整使用说明和架构图
- passes: true

## F15: SVG 图示链路替换 Mermaid
- 目标：让 visual-planner 直接输出 SVG 源码，diagram-renderer 仅负责落盘为 .svg；完全移除 Mermaid/mmdc 依赖。达到 claude.ai visualizer 级别的样式可控性（圆角 + 虚线分组 + 多色分区 + 中英混排）
- 验收：
  - `article-diagram-renderer.md` 不再引用 Mermaid/mmdc，改为抽取 ```svg 代码块写入 `.article-work/img/diagram_N.svg`
  - `article-visual-planner.md` 给出 SVG 编写规范（xmlns、字体 fallback、颜色限制、禁用 foreignObject）与样本模板
  - `enhance.md` / `CLAUDE.md` / `README.md` 同步更新命名、依赖、Agent 描述
  - grep 在 `article-plugin/` 下无 `mermaid` / `mmdc` 残留（除 F09 历史记录外）
  - 手工构造一个包含 ```svg 代码块的 04-visual.md，renderer 能正确生成 `diagram_1.svg` 且浏览器可打开
- passes: true

## F16: /explain 英文论文/网页中文讲解命令
- 目标：新增 `/explain <URL|PDF|MD>` 命令，支持英文论文/网页文章 → 中文讲解稿（含译文、事实订正、SVG 图示、相关文献），单轮成稿不迭代
- 验收：
  - 新增 3 个 Agent：`article-translator`（opus）、`article-related-finder`（sonnet+WebSearch+WebFetch）、`article-explainer`（opus）
  - 新增 `commands/explain.md`，编排：输入预处理 → 第一层 4 Agent 并行（translator/accuracy-checker/related-finder/visual-planner）→ diagram-renderer 落盘 → explainer 合成
  - 工作目录使用 `.article-work-explain/`（与 `.article-work/` 隔离）
  - 三种输入形态：URL（WebFetch）、PDF（复用 prepare_article_pdf.py）、Markdown（直接拷贝）
  - `CLAUDE.md` / `README.md` 同步更新：命令清单、Agent 清单、中间文件目录
  - 支持 `--resume` 从中断处继续
- passes: true

## F17: 修复 /explain 输出图片相对路径错误
- 目标：`05-explanation.md` 在 `.article-work-explain/` 根目录，应使用 `img/diagram_N.svg` 引用，而非 `../img/...`（后者会越过工作目录到达父目录）
- 验收：
  - `agents/article-explainer.md` 图示集成规则改为 `img/diagram_N.svg`，并解释路径与 `source/origin.md` 不同
  - `commands/explain.md` 第二层 explainer 调用指令同步更正
  - 实际生成的 `05-explanation.md` 中所有 `![](img/diagram_*.svg)` 可被 markdown 渲染器正常解析（不再 404）
- passes: true

## F18: PDF 提取图按 figure 合并，避免数百碎片
- 目标：研究论文 figure 在 PDF 中常被切成几十个 image XObject（如 8x8 demo grid），原脚本逐 XObject 导出会让 `img/` 出现 800 个 fig_N 文件，origin.md 也被切成几十条 `![]()` 引用，下游 agent 无法识别"这是同一张 figure"。改成：用 pdfplumber 拿到每张 image 的页面坐标 → 同页按竖向间距聚类 → 对每个 cluster 的并集 bbox 调用 `page.crop(bbox).to_image(resolution=180)` 渲染为单张 PNG
- 验收：
  - `skills/pdf/scripts/prepare_article_pdf.py` 不再逐 XObject 写文件；改为聚类 + 渲染 PNG
  - 对 latent_action 论文（28 页，799 个 image XObject）输出仅 21 张 `fig_N.png`；Figure 4（64 tile）合并为 1 张；page 20 的 Figure 10 + Figure 11 自动拆成 2 张
  - 渲染图肉眼可读，DPI 180 下大小适中（数百 KB / 张）
  - 文档同步更新：`skills/pdf/SKILL.md`、`CLAUDE.md`、`README.md`、`commands/{review,enhance,explain}.md`、`agents/article-explainer.md` 中的 `fig_N.{jpg,png}` 改为 `fig_N.png` 并解释合并逻辑
- passes: true
