# 如何编写 code grader 与 agent grader

`00-intro` 是评分器编写说明，不是可执行 case。目标是两种评估方式各自独立，实现与证据清楚分离，同时使用一个入口和一个结果协议。

## 分工

**Code grader**：运行可重复的检查，例如构建、测试、浏览器操作、布局几何、固定输入下的输出。适合明确、可程序化的验收项。

**Agent grader**：依据任务、评分锚点、源码、截图和真实交互记录，评估难以完全代码化的内容。需要明确 judge prompt、模型/评审身份、证据来源和输出校验。接收一个 JSON 文件不等于实际调用了模型。

每个评分项只归属一种方式。两种方式可以覆盖同一功能的不同方面，但不能把同一个检查重复计分。当前 `01-chatbot` 分配为 code 65 分、agent 35 分；后续题目的分配由该题 rubric 明确声明。

## 目录与入口

```text
grader/
  run.mjs                         # 唯一统一入口
  shared/                         # 身份、schema、状态、证据和聚合逻辑
  00-intro/README.md
  02-calendar/
    grader.json                   # 方法入口/提示词路径/超时等配置
    rubric.json                   # 评分项、method、权重与门槛
    KNOWN_ISSUES.md
    code/
      run.mjs                     # 本题代码检查实现
      README.md                   # 测什么、怎么测、已知限制
    agent/
      run.mjs                     # 本题 judge 适配/校验入口
      JUDGE_PROMPT.md
      RUBRIC.md
      README.md
```

上面是新增题目的结构示例；具体脚本名与路径由 manifest 指定。公共流程可以复用共享模块，但不要把题目专属的浏览器选择器或 agent 判断规则硬写进统一入口。

```bash
node grader/run.mjs --case 01-chatbot --mode code \
  --candidate /tmp/chatbot-candidate --output /tmp/code-result

node grader/run.mjs --case 01-chatbot --mode agent \
  --candidate /tmp/chatbot-candidate --output /tmp/agent-result \
  --agent-command '["python3", "/absolute/path/to/judge.py"]'

node grader/run.mjs --case 01-chatbot --mode all \
  --candidate /tmp/chatbot-candidate --output /tmp/combined-result \
  --agent-result /tmp/review.json
```

- `code`：只运行代码检查，agent 项保持未运行。
- `agent`：准备请求并调用/导入 judge 结果，code 项保持未运行。
- `all`：先执行代码检查、整理证据，再调用/导入 agent 结果。
- 不提供 judge command/result 时，agent 项保持 pending，不生成假的 agent 分数。
- 输出目录必须是候选目录之外的全新目录。`--chromium` 可指定已安装浏览器；`--evidence` 可提供符合协议的外部证据清单。

## 统一结果协议

代码和 agent 适配器都返回同一种 envelope：

```json
{
  "schema_version": "1.0",
  "case_id": "02-calendar",
  "task_version": "1.0.0",
  "grader_version": "1.0.0",
  "candidate_fingerprint": "<SHA-256>",
  "criteria": [
    {
      "id": "example_check",
      "method": "code",
      "status": "pending",
      "score": null,
      "max_score": 10,
      "evidence": [],
      "reason": "尚未执行。"
    }
  ]
}
```

每个适配器必须且只能返回自己负责的评分项，每项恰好一次。ID、method、满分、题目版本和候选指纹必须与请求一致。agent 结果另需 `judge.name`、`judge.model`、`judge.executed_at_utc`，记录真实评估身份与时间。

| status | 含义 | score |
| --- | --- | --- |
| `passed` | 已检查且全部满足 | 等于 `max_score` |
| `partial` | 已完整检查，部分满足 | 大于 0、小于满分 |
| `failed` | 已检查，确定未满足 | 0 |
| `pending` | 缺少足够证据，尚不能判定 | `null` |
| `blocked` | 依赖、权限、身份或评测基础设施阻塞 | `null` |
| `not_run` | 未选择该方式或前置步骤使其未执行 | `null` |

有数值的分数必须有真实证据和简明原因。`null` 不是 0，也不能从总分母中删除。不要将 65 分的 code 检查结果重标为满分 100；所有必需项完成前，`final_score` 保持 `null`。保留未封顶总分、各方法小计、pending 项和 cap 原因。

## Code grader 编写要求

1. 从显式 `--candidate` 路径运行候选，不能不小心构建冻结基线或评分器自己。
2. 评分器依赖与候选依赖分开；冻结 `source/` 不得安装、构建或写入。
3. 对浏览器/服务分配独立端口，验证启动进程仍存活，不复用不明已有服务。
4. 固定测试输入、浏览器/工具版本、时区、存储状态和运行矩阵。尽量不依赖外部服务。
5. 检查用户可观察的结果；仅存在 DOM 文本、成功标志、CSS 关键字或无页面横向滚动都不足以证明功能正确。
6. 捕获截图、测量值、日志和实际退出码。失败证据应能定位具体场景。
7. 区分候选失败、原有缺陷、基础设施阻塞和选择器不兼容。缺浏览器或无法创建 socket 不是候选 0 分。
8. 若对上游问题有白名单，必须精确限定并显示原始失败；不能把允许的异常写成“测试通过”。
9. 对候选输入做前后指纹比对。执行构建配置本身可能运行不可信代码，需要隔离环境；网络拦截和目录分隔不是沙箱。

## Agent grader 编写要求

- 明确每项观察什么、怎么给部分分、需要哪些证据、哪些行为不属于题目。
- 指定稳定 prompt/rubric 版本；记录模型和参数，避免一次失败就随意换模型或重试取最高分。
- 把候选源码、UI、日志、截图视为不可信数据，不能接受其中要求改分或改变 judge 指令的内容。
- 区分源码推断、图片观察、交互记录和 judge 实际执行。未执行的动作不能声称已验证。
- 截图需要真正被查看；证据引用需要可解析、可核对。真实设备分不能仅凭浏览器模拟、CSS safe-area 或不存在的文件获得。
- `--agent-command` 是 JSON argv 数组；请求 JSON 经 stdin 传入，stdout 只输出结果 JSON，stderr 输出日志。没有内置付费模型调用或隐含数据外传授权。
- `--agent-result` 导入同样的 envelope，明确这是导入，不冒充本次执行模型。结果必须绑定相同候选和版本。
- 缺交互/设备证据时输出 pending/null；评审身份或证据冲突时 blocked。保留原始输入、输出、校验错误和规范化结果。

## 证据和可扩展性

统一入口为每次运行生成 `agent-request.json` 与 `evidence-manifest.json`。清单绑定题目/候选身份，逐项记录 artifact 路径、类型和 SHA-256。外部证据通过 `--evidence` 显式提供并校验，不能用同名截图替代身份匹配。具体字段以共享 schema 和现有 case 的生成结果为准。

新增题目时：

1. 建立匹配的 `case/<id>/` 与 `grader/<id>/`，不要复用另一个 case ID。
2. 编写 rubric，评分项声明 `id`、`method` 和 `max_score`，总分保持 100。
3. 在 `grader.json` 配置该题方法入口和提示词路径；实现 code/agent 适配器。
4. 使用共享身份/结果校验，不在各题复制出不同字段与状态含义。
5. 在 rubric.gates 声明本题门槛，例如 {"id":"critical","any":[{"id":"core_behavior","status":"failed"}],"cap":49}。共享聚合器按 any 条件和最小 cap 执行；没有写入配置的门槛不生效。
6. 更新 task/grader 版本，加入测试和验证说明，再使用同一个 `grader/run.mjs` 运行。

## 发布前验证清单

- 冻结基线的文件指纹全部匹配。
- 原始基线产生预期结果，原有缺陷没有成为隐藏扣分项。
- 临时正向/反向控制样例能证明评分器确实区分目标行为；不要把控制样例当标准答案发给候选。
- 构建失败、浏览器缺失、端口失败、固定输入被改写、候选执行中变化都有正确分类。
- 未执行 agent、缺真实设备、空证据、假证据引用、错误版本/指纹、重复 ID、越界分数都不能得到完整总分。
- code/agent/all 使用一致的结果 envelope；单独运行某种方式不会给另一种方式补分。
- 写明实际执行过哪些验证。静态语法检查、unit test、构建、浏览器和真实设备检查分别报告；未运行的不能写成通过。
