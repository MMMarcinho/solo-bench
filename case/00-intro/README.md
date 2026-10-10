# 如何新增一个 case

`00-intro` 是出题说明，不是可执行题目。当前示例是 `01-chatbot`；新增题目时使用稳定的新 ID，例如 `02-calendar`。

## 先明确评什么

每道题只覆盖一个清楚的工程目标。先写出：

1. 初始项目、启动方法和已知问题。
2. coding agent 需要完成的变化。
3. 必须保留的既有行为。
4. 可观察的验收条件、测试环境和范围边界。
5. 提交内容、允许的工具/联网范围，以及统一的时间或成本预算。

任务要求与评分项应一一对应。不要把没有写在任务中的产品能力、重构偏好或原有 bug 修复悄悄加进评分。风格要求应描述可用性和设计层级，不应偏好某个组件库、CSS 写法或代码行数。

## 推荐结构

```text
case/
  00-intro/README.md
  02-calendar/
    case.json
    TASK.md
    SETUP.md
    PROVENANCE.md
    source.sha256.json
    source/
      package.json
      package-lock.json
      src/...
      attachment/...
```

- `source/`：冻结的初始项目。不要在这里安装依赖、输出构建产物或实现答案。
- `TASK.md`：直接发给被测 coding agent 的题目。包含验收行为、公开测试钩子、范围边界、交付方式；不包含评分权重、评分脚本或标准答案。
- `SETUP.md`：实际可运行的环境和命令，注明版本、是否需要联网、是否需要凭据、已知环境限制。
- `PROVENANCE.md`：来源仓库、精确 commit、获取日期、许可证，以及任何清理/修改。
- `source.sha256.json`：每个冻结文件的相对路径与 SHA-256，用于证明基线没有被改写。
- `case.json`：机器可读的题目身份、路径、环境、固定输入及公开钩子。

设计稿放在题目源码的 `attachment/` 或明确说明的素材目录。注明哪些是参考、哪些必须保留、哪些只是示例文字。图片题应保证被测 agent 能实际查看图片。

## case.json 的最小含义

当前 `01-chatbot/case.json` 是可用范例。关键字段包括：

| 字段 | 用途 |
| --- | --- |
| `schema_version` | manifest 结构版本 |
| `case_id` | 与 case/grader 目录名一致的稳定 ID |
| `task_version` | 题目版本；验收或输入变化时更新 |
| `title` | 题目名称 |
| `source.repository`、`source.commit` | 可追溯且固定的来源 |
| `source.directory`、`source.sha256_manifest` | 基线与指纹清单的位置 |
| `entrypoint`、`setup` | 任务正文和启动说明 |
| `runtime` | 运行版本、依赖安装方式、服务需求 |
| `protected_fixtures` | 不允许候选改写的固定输入 |
| `evaluation_hooks` | 明确向候选公开的观察接口 |
| `viewports` 或同类场景字段 | 适合本题的固定运行矩阵 |

不要把 API key、用户真实数据、账号凭据或私有环境路径放入题包。若无法合法再分发源码/素材，记录限制并提供合规获取方式；公开仓库不等于已有再分发许可。

## TASK.md 写作清单

- 描述目标结果，避免规定不必要的实现方案。
- 给出具体用户流程，例如打开、关闭、切换、输入、发送、回退和窗口变化。
- 明确桌面/移动端或其他既有能力的回归边界。
- 指出固定输入和不得伪造的测试钩子。
- 说明不要求做什么，例如未配置的后端、持久化、登录或上传服务。
- 公开重要的浏览器/设备/尺寸限制。不能用评分器私有条件制造意外失败。
- 允许候选说明未验证项目；未验证不应自动等同于失败或成功。
- 不提供评分权重、内部 judge prompt、评分结果、其他候选答案或参考实现。

## 冻结和发题流程

1. 固定来源 commit，完整检查运行说明和有关授权。
2. 在独立临时副本上做干净安装、构建和必要的浏览器基线检查。
3. 把原有缺陷与本题要解决的问题分开；在 task/setup 和 grader known issues 中保持一致。
4. 生成文件指纹，核对冻结源码与来源一致；如有变更，逐项记录。
5. 用独立目录创建候选工作区，只复制源码和必要素材。
6. 发给 coding agent 的输入只包含该候选源码、`TASK.md` 和 `SETUP.md`。将 `grader/` 保留在独立的评测环境。
7. 运行结束后固定候选 revision/指纹，再交给统一评分入口。

`tools/create-candidate.py` 和 `tools/verify-source.py` 默认针对 `01-chatbot`，也支持显式传入 `--case '02-GPT6 介绍页滚动效果'`。新增题目时要继续扩展显式 case ID，或提供该题等价工具；不要假定它们会自动操作新目录。

## 与 grader 的边界

每个 `case/<id>/` 对应 `grader/<id>/`。出题者定义公开要求，评分器分别用代码和 agent 证据检查这些要求。评分结构、证据协议和新增 grader 步骤见 `../../grader/00-intro/README.md`。

更改初始输入或公开验收时更新 `task_version`；更改权重、判断标准、测试矩阵或 judge prompt 时更新 `grader_version`。比较不同 agent 时，必须使用同一套版本、预算和环境，并保存原始证据。不能在看到某个候选表现后单独调整标准。
