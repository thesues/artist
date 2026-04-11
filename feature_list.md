# Article Enhancement Plugin — Feature List

## F01: 项目骨架与插件目录结构
- 目标：创建 article-plugin/ 目录结构（agents/, commands/, scripts/, skills/）+ CLAUDE.md
- 验收：目录结构与 patent-plugin 一致，CLAUDE.md 描述完整架构
- passes: true

## F02: codex-task.mjs 脚本
- 目标：从 patent-plugin 复制并适配 codex-task.mjs，修改 serviceName
- 验收：脚本可独立运行（`node scripts/codex-task.mjs --help` 不报错）
- passes: true

## F03: Agent — article-fact-checker (opus + WebSearch)
- 目标：验证文中事实性陈述、数据、统计是否准确
- 验收：agent md 文件格式正确，frontmatter 包含 name/description/tools/model
- passes: true

## F04: Agent — article-source-finder (sonnet + WebSearch)
- 目标：查找缺失引用、验证现有引用、补充关键参考文献
- 验收：agent md 文件格式正确
- passes: true

## F05: Agent — article-depth-analyzer (opus)
- 目标：识别技术描述浅薄的段落，指出需要展开的原理/机制/对比
- 验收：agent md 文件格式正确
- passes: true

## F06: Agent — article-depth-analyzer-codex (haiku + codex)
- 目标：深度分析的 Codex 多样性视角
- 验收：agent md 文件格式正确，调用 codex-task.mjs 的流程清晰
- passes: true

## F07: Agent — article-logic-reviewer (sonnet)
- 目标：检查论证链连贯性、逻辑跳跃、前后矛盾
- 验收：agent md 文件格式正确
- passes: true

## F08: Agent — article-style-auditor (opus) — 去 AI 味核心
- 目标：检测 AI 写作痕迹，建议自然人类表达替换
- 验收：agent md 文件格式正确，包含详细的 AI 味检测规则
- passes: true

## F09: Agent — article-terminology-checker (sonnet + WebSearch)
- 目标：验证术语准确性、中英文对照一致性
- 验收：agent md 文件格式正确
- passes: true

## F10: Agent — article-structure-analyzer (sonnet)
- 目标：评估章节组织、信息密度分布、读者体验
- 验收：agent md 文件格式正确
- passes: true

## F11: Agent — article-visual-planner (sonnet + WebSearch + MCP Chrome)
- 目标：规划流程图/架构图，从论文/网站截取参考图示
- 验收：agent md 文件格式正确，包含 MCP Chrome 截图流程
- passes: true

## F12: Agent — article-content-aggregator (opus)
- 目标：聚合深度分析和逻辑审查结果
- 验收：agent md 文件格式正确
- passes: true

## F13: Agent — article-review-aggregator (opus)
- 目标：汇总所有 Agent 报告，生成统一审查报告
- 验收：agent md 文件格式正确
- passes: true

## F14: Agent — article-diagram-renderer (sonnet + Bash)
- 目标：用 Mermaid 渲染流程图/架构图/时序图
- 验收：agent md 文件格式正确，包含 mmdc 渲染命令
- passes: true

## F15: Agent — article-screenshot-capturer (sonnet + MCP Chrome)
- 目标：从指定 URL 截图，保存到 img/
- 验收：agent md 文件格式正确
- passes: true

## F16: Agent — article-rewriter (opus + AskUserQuestion)
- 目标：根据审查报告逐条修改，支持多轮迭代，与用户交互确认
- 验收：agent md 文件格式正确，包含 AskUserQuestion 使用场景定义
- passes: true

## F17: Command — /review（快速审查，不修改）
- 目标：对文章进行多维度审查，输出审查报告
- 验收：command md 文件完整，定义三层 Agent 调度流程
- passes: true

## F18: Command — /enhance（完整增强，含迭代改写）
- 目标：审查 + 图示生成 + 多轮迭代改写的完整流程
- 验收：command md 文件完整，包含迭代回路逻辑和中断恢复
- passes: true

## F19: PDF 输入预处理 Skill
- 目标：PDF → origin.md + img/ 提取流程
- 验收：skill 目录结构完整，prepare_article_pdf.py 脚本可用
- passes: true

## F20: 集成验证与 README
- 目标：端到端测试 /review 和 /enhance 命令，更新 README
- 验收：README 包含完整使用说明和架构图
- passes: true
