# 启动与发题

需要 Node.js 20+ 和 Python 3。本题候选不需要 npm 依赖、账号、密钥或真实服务。

在仓库根目录：

```sh
python3 tools/verify-source.py --case 04-creation-dialog-race
python3 tools/create-candidate.py --case 04-creation-dialog-race /tmp/creation-dialog-candidate
cd /tmp/creation-dialog-candidate
node server.mjs
```

打开终端打印的地址（默认 `http://127.0.0.1:4174`）。端口已被占用时可用 `PORT=0 node server.mjs` 选择空闲端口。评分器也使用该启动接口。

快速复现：打开「新建项目」，填写名称，选择「使用模板」，选「创作工作室」后立即改选「实验小组」。后者先加载完成，但较慢的工作室响应稍后会覆盖预览。此时点击创建，基线甚至可能提交为工作室。这个缺陷是待修复的任务，不是已通过的示例。

盲测时只交付候选副本、TASK.md、SETUP.md；把 grader 和结果证据留在独立环境。候选代码可执行，只在无凭据的可丢弃环境中评分。
