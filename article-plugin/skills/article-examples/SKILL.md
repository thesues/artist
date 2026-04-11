---
name: article-examples
description: 参考文章库，存放高质量技术文章作为风格和质量的参考标杆。将参考文章放入 examples/ 目录即可自动加载。
---

# 参考文章库

将高质量的技术文章（.md 格式）放入 `${CLAUDE_PLUGIN_ROOT}/examples/` 目录。

审查流程中的 review-aggregator 和 rewriter 会参考这些文章的风格和深度作为质量目标。

## 使用方式

1. 将参考文章复制到 `examples/` 目录
2. 运行 `/review` 或 `/enhance` 时自动加载
3. Agent 会参考这些文章的写作风格，但不会复制内容
