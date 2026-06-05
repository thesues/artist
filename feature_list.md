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

## F19: 父协调层路径化输入 + /enhance loop 上限压到 2 轮
- 目标：消除父协调层在构造并行 agent prompt 时持有多份"全文+图片"副本导致的 token 放大；同时把 /enhance 验证循环从最多 4 轮压到最多 2 轮，去掉收益递减的尾部循环
- 验收：
  - `commands/{review,enhance,explain}.md` 的 layer1 输入表全部改为"路径写法"（不再写"全文 + 图片"）
  - `commands/{review,enhance,explain}.md` 显式声明"调用方不得把文件内容或图片嵌入 prompt"
  - `commands/enhance.md` 验证循环阈值由 N<4 改为 N<2，文件清单移除 rewrite-round-3/4
  - `agents/article-{accuracy-checker,content-reviewer,style-auditor,visual-planner,translator,related-finder,rewriter,explainer}.md` 全部从"图像输入"改为"输入加载"段，明确"调用方只传路径，agent 自行 Read，按需加载图片"
  - `CLAUDE.md` / `README.md` 中"最多 3 轮"改为"最多 2 轮"
  - grep `article-plugin/` 下不再出现"图像输入" / "多模态输入"等老措辞
  - 端到端跑一篇带图论文（建议复用 latent_action 论文做回归），父对话 token 较旧版下降 ≥40%，产出无明显劣化
- passes: false

## F20: Hermes 多样性视角集成（content + style + accuracy 三 Agent）
- 目标：在现有 Codex 第二意见之外，增加 Hermes Agent（Nous Research）作为第三方模型视角，提供 Claude × Codex × Hermes 三方交叉验证。复用 codex-task.mjs 的接口模式：haiku 转发器 + 独立 Node 运行时脚本 + 可选可用性 gate
- 验收：
  - 新增 `scripts/hermes-task.mjs`：spawn `hermes chat -q PROMPT -Q`，接受 `--cwd / --prompt-file / --output-file`，与 codex-task.mjs flag 兼容（不支持的 flag 静默忽略）
  - 新增 3 个 Hermes Agent：`article-content-reviewer-hermes`、`article-style-auditor-hermes`、`article-accuracy-checker-hermes`，均为 haiku+Bash 转发器
  - `commands/{review,enhance}.md` 第一层并行启动表加入 1-hermes / 2-hermes / 3-hermes（共 8 个 Agent），并加入 `which hermes` 可用性检查
  - `commands/explain.md` 第一层加入 2-hermes（accuracy-checker-hermes）；explainer 输入清单条件加载 `02-accuracy-hermes.md`
  - `agents/article-review-aggregator.md` 输入列表扩到 8 路（含 3 个可选 Hermes 报告），交叉验证逻辑改为 Claude × Codex × Hermes 三方（≥2 一致 → 高置信；2-of-3 多数 → 采纳；孤立 → 待复核）；分歧小节标题改为 `Agent 间分歧（Claude × Codex × Hermes）`
  - `CLAUDE.md` / `README.md` 同步：第一层 Agent 数从 5 改为 8，加入 Hermes 集成小节，依赖列表加入 `hermes` CLI（可选），文件清单加入 `*-hermes.md` 与 `.hermes-prompt-*.md`
  - 端到端：用 latent_action 论文跑一遍 `/explain`，确认 `02-accuracy-hermes.md` 生成且 explainer 把它纳入输入；移除 hermes 后再跑一次，确认整套 Hermes 优雅跳过、其余 Agent 正常完成
- passes: false

## F21: article-style-auditor 内置确定性 AI 味词典（命中即必改）
- 目标：原 style-auditor 只有描述性规则、靠模型自由判断，漏检率高、"AI 味仍浓"。增加一份确定性黑名单词典，命中即判定 AI 味、强制列入 🔴 必须改写，把"是否 AI 味"从主观判断变成"先扫词典再补充判断"的并集。词条来源于 web search（ChatGPT/AIGC 高频词、中文套话、商业黑话、Humanizer-zh 24 模式、英文 AI 直译词）
- 验收：
  - `agents/article-style-auditor.md` 新增「AI 味词典」小节，分 A 套话连接词 / B 商业黑话 / C AI 高频形容词动词 / D 模板化开头结尾 / E 英文 AI 直译词 五类；并指示 opus 版用 `Grep` 逐条扫描主文件，命中一律 🔴
  - 含「真术语豁免」细则（如向量的维度、模型的鲁棒性、端到端训练），豁免须在表格标注依据
  - 审查摘要要求注明「词典命中 N 处」，N 影响 AI 味评分
  - `agents/article-style-auditor-hermes.md` 的 `grounding_rules` 同步加入「六、AI 味词典」，使 Hermes 第三方视角也强制执行同一份黑名单（Hermes 无 Grep，按 prompt 内联扫描）
  - 文档同步：CLAUDE.md / README.md 提及词典；claude-progress.txt 记录
- passes: true

## F18: PDF 提取图按 figure 合并，避免数百碎片
- 目标：研究论文 figure 在 PDF 中常被切成几十个 image XObject（如 8x8 demo grid），原脚本逐 XObject 导出会让 `img/` 出现 800 个 fig_N 文件，origin.md 也被切成几十条 `![]()` 引用，下游 agent 无法识别"这是同一张 figure"。改成：用 pdfplumber 拿到每张 image 的页面坐标 → 同页按竖向间距聚类 → 对每个 cluster 的并集 bbox 调用 `page.crop(bbox).to_image(resolution=180)` 渲染为单张 PNG
- 验收：
  - `skills/pdf/scripts/prepare_article_pdf.py` 不再逐 XObject 写文件；改为聚类 + 渲染 PNG
  - 对 latent_action 论文（28 页，799 个 image XObject）输出仅 21 张 `fig_N.png`；Figure 4（64 tile）合并为 1 张；page 20 的 Figure 10 + Figure 11 自动拆成 2 张
  - 渲染图肉眼可读，DPI 180 下大小适中（数百 KB / 张）
  - 文档同步更新：`skills/pdf/SKILL.md`、`CLAUDE.md`、`README.md`、`commands/{review,enhance,explain}.md`、`agents/article-explainer.md` 中的 `fig_N.{jpg,png}` 改为 `fig_N.png` 并解释合并逻辑
- passes: true
