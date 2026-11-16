# 运行

需要 Python 3 和现代 Chromium 浏览器；无 npm 依赖、密钥或联网需求。

```bash
python3 tools/verify-source.py --case 03-cyberpunk-tactics
python3 tools/create-candidate.py --case 03-cyberpunk-tactics /tmp/cyberpunk-candidate
cd /tmp/cyberpunk-candidate
python3 -m http.server 8033 --bind 127.0.0.1
```

访问 http://127.0.0.1:8033 。交给被测 agent 的内容仅为候选目录、TASK.md、SETUP.md。starter 是空白起点，不应作为已实现游戏验收；不要给候选参考实现或 grader。

当前交付范围为题目包与空白起点，尚未提供参考实现或接入 `grader/run.mjs`，不能将本题描述为已完成自动评分验证。

建议在 Chromium 中分别以 1440×900 和 390×844 检查 TASK.md 的验收清单。不要在冻结的 starter 内实现答案或写入缓存。代码完成后，在候选目录附上验证说明，区分实际操作验证与尚未验证的项目。

出题包不设隐含的时间或费用限制；组织对比评测时，应在开始前为所有候选公布相同预算，独立记录，不把未公布的预算作为扣分项。
