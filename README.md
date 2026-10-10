# solo-bench

一个可扩展的 coding-agent benchmark。包含 `01-chatbot` 移动端适配题和 `02-GPT6 介绍页滚动效果` 滚动文章动效题；两题共用 `grader/run.mjs`、结果 schema、候选指纹和 code/agent 分工。根目录 `index.html` 是书册目录，可进入 Case 02 的本地参考效果。Case 01 **没有实现移动端答案**；原始上游版本见 [`chatbot-baseline` 的固定 commit](https://github.com/MMMarcinho/chatbot-baseline/tree/609b54a171d6536357810ec9baf1d0785c30fff1)。

```text
solo-bench/
├── assets/                       # 两张生成头像原图
├── case/
│   ├── 00-intro/                # 新用例写作格式、模板
│   ├── 01-chatbot/
│   │   ├── TASK.md / SETUP.md
│   │   ├── case.json / source.sha256.json
│   │   └── source/             # 75 文件桌面设计衍生基线
│   └── 02-GPT6 介绍页滚动效果/    # 中文文章动效题与最小 starter
├── reference/02-GPT6 介绍页滚动效果/ # 独立参考演示
└── grader/
    ├── 00-intro/               # 评分器开发规范、模板
    ├── run.mjs                 # 所有用例/两种方式的统一入口
    ├── shared/                # 统一协议、结果 schema、校验、聚合、测试
    ├── 01-chatbot/
    └── 02-GPT6 介绍页滚动效果/    # 两题各有 code 与 agent 适配器
```

## 1. 准备被测代码

需要 Node 20+、npm、Python 3 和 Chromium。依赖安装需要联网；应用运行不需要模型 API、密钥、登录或后端。

```bash
python3 tools/verify-source.py
python3 tools/create-candidate.py /tmp/chatbot-candidate
cd /tmp/chatbot-candidate
npm ci --ignore-scripts --legacy-peer-deps --cache /tmp/solo-bench-npm-cache
npm run dev
```

把 `case/01-chatbot/TASK.md`、`SETUP.md` 和候选源码交给 coding agent。盲测时把 `grader/` 放在它无法读取的独立环境；仅目录分开不能保证隔离。不可在只读基线 `source/` 中安装依赖或改代码。`source.sha256.json` 锁定当前设计衍生基线；固定的上游 commit 仅用于追溯来源。

## 2. 统一启动评分

```bash
cd /path/to/solo-bench/grader
npm ci --ignore-scripts --cache /tmp/solo-bench-grader-cache
npx playwright install chromium
npm test
cd ..

# 只执行 code 评分
node grader/run.mjs --case 01-chatbot --mode code \
  --candidate /tmp/chatbot-candidate --output /tmp/result-code

# 两种方式：未提供 judge 时，agent项明确 pending
node grader/run.mjs --case 01-chatbot --mode all \
  --candidate /tmp/chatbot-candidate --output /tmp/result-all

# 调用你自己的 judge CLI（JSON argv，不经 shell 拼接）
node grader/run.mjs --case 01-chatbot --mode all \
  --candidate /tmp/chatbot-candidate --output /tmp/result-judged \
  --agent-command '["your-judge-cli","--json"]'

# 或导入已实际执行的 judge JSON
node grader/run.mjs --case 01-chatbot --mode agent \
  --candidate /tmp/chatbot-candidate --output /tmp/result-agent \
  --evidence /tmp/evidence-manifest.json --agent-result /tmp/judge-result.json
```

已有系统浏览器时可加 `--chromium /usr/bin/chromium`。输出目录必须不存在，避免覆盖证据。`--metadata` 接受可选的 `run-metadata.template.json`；费用、用时、attempt 独立记录，不混入功能分。

没有绑定付费模型。`--agent-command` 由调用方提供，接收 `agent-request.json` 内容作为 stdin，stdout 返回规定 JSON，stderr 输出日志。该命令若使用付费服务，费用/授权由调用方负责。本包的 agent adapter 负责协议和证据校验，**不冒充已运行的 judge**。

## 3. 一种结果格式

所有路径都输出 `result.json`：版本、用例、本地 source revision、上游 commit、候选 fingerprint、统一 criteria、score、环境和成本/用时元数据。每个 criterion 都用 `id / method / status / score / max_score / evidence / reason`。

- `passed / partial / failed`：已有证据，可计分
- `pending / blocked / not_run`：分数为 `null`
- code 65分，agent 35分；缺任何项，`final_score` 都是 `null`
- 真实设备的键盘/安全区项需要 physical_device 证据；浏览器模拟不算
- `agent-request.json` 和 `evidence-manifest.json` 可用于后续 judge
- schema：`grader/shared/result.schema.json`；adapter协议：`adapter-result.schema.json`

code assertions按类别全有或全无；agent rubric有逐点锚定的部分分。详细要求见各自 `code/README.md` 和 `agent/`。新增用例先看两个 `00-intro/`。

## 当前验证状态

公开版的验证结果和环境限制见 [`VALIDATION-SUMMARY.md`](VALIDATION-SUMMARY.md)。基线 `npm run build` 已知 Node 类型缺失错误；评分器只允许精确两个既有诊断，不掩盖新增错误。没有真实 judge 或真机证据时不产生完整评分。

## 来源、安全和许可

上游来源为 https://github.com/MMMarcinho/chatbot-baseline ，固定 commit `609b54a171d6536357810ec9baf1d0785c30fff1`。当前 `source/` 是 `01-chatbot-local-design-avatar-v2`，参考用户本地 UI 组件的视觉语言所作的桌面设计衍生稿。未复制该私有参考仓库的代码或素材。开发机的旧压缩备份、原始验证日志、依赖和构建输出均不在公开仓库中。本仓库未附加开源许可证；来源见 `case/01-chatbot/PROVENANCE.md`。

候选 build/config 是可执行代码。请在无凭据、网络受 OS 限制的可丢弃容器运行。浏览器 request blocking 用于确定性，并不是代码安全沙箱。依赖生命周期脚本默认禁用；有依赖/config变化时先检查再运行。不要推送、部署或调用真实模型来完成本题。

## Case 02：滚动文章动效

`case/02-GPT6 介绍页滚动效果/starter/` 是故意未完成动效的候选起点；`reference/02-GPT6 介绍页滚动效果/` 是独立参考演示，不交给被测 agent。公开任务和设置分别见 `case/02-GPT6 介绍页滚动效果/TASK.md` 与 `SETUP.md`。参考效果使用原创文案、系统字体和抽象 CSS 媒体，是按公开观察独立编写的交互示例，不是原站整页像素复刻。

```bash
python3 tools/verify-source.py --case '02-GPT6 介绍页滚动效果'
python3 tools/create-candidate.py --case '02-GPT6 介绍页滚动效果' /tmp/scroll-story-candidate
node grader/run.mjs --case '02-GPT6 介绍页滚动效果' --mode all \
  --candidate /tmp/scroll-story-candidate --output /tmp/scroll-story-result
```

Case 02 复用既有结果格式与 `pending/null` 语义。中文标题“推出智能界面”的指针接触、拖动、释放、暂停及逆向滚动由 Chromium 独立采样；蓝色逐行高亮、窄屏、resize 和 reduced-motion 也由 code adapter 验证。验证摘要见 [`VALIDATION-SUMMARY.md`](VALIDATION-SUMMARY.md)。未调用 judge 时 agent 项保持 pending，`final_score` 为 null。
