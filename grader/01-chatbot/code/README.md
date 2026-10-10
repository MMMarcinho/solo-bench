# Code评分器

由统一入口 `node grader/run.mjs --case 01-chatbot --mode code|all ...` 调用。不要另写一套汇总逻辑。这里仅运行 code criteria；`agent/` 独立负责 judge 的任务和输出适配。

## 65分的可执行检查

- build10：直接执行候选本地 TypeScript `--noEmit` 和 Vite production build。不执行候选任意 npm scripts。只豁免 KNOWN_ISSUES.md 中精确两条上游缺少 @types/node 的诊断，原始 typecheck exit/status 保留；其他任何类型错误不豁免。此项叫 baseline-compatible build，不宣称 npm run build 通过。
- desktop_core15：1280×900、1440×900，在初次历史加载完成后搜索/恢复列表、普通会话切换、发送并清空、展开/折叠工具详情，检查双栏和输入区。
- mobile_geometry20：360×800、390×844、402×874、430×932，加768×1024和844×390。检查页面/会话/textarea可见边界、宽度、中心点击命中；手机主会话宽度不应被桌面侧栏挤占。它不是完整的可用性或真机检查。
- mobile_send10：四种手机视口，用实际点击发送，一条唯一消息、清空输入，并检查消息可见边界。
- long_content10：402×874，固定 URL/文件名文字存在；检查相关文本与代码的横向边界、祖先裁切和消息内部水平滚动。它不覆盖真实附件上传/FileCard，也不证明所有 Markdown/多语言内容都正确。

每个类别是全有或全无。窗口中某个子检查失败会失去该类全部分。声明的矩阵/阈值固定；改规则需提升 grader version。浏览器缺失或启动失败是 blocked，不能当候选0分。对合法重构但定位器不兼容的情况要明确做兼容性复核，不能把缺少旧class本身当功能失败。

## 输入与输出

内部 adapter：`node code/run.mjs --candidate ABS_PATH --output NEW_ABS_PATH [--chromium ABS_PATH]`。输出 `result.json` 中的统一 criterion envelope，由共享入口校验再聚合。原始 `checks`/logs保留为证据；不在此层最终计分。对候选源码执行前后 fingerprint，以发现评分过程中修改。

代码定位优先既有 `data-testid=conversation`，语义按钮/placeholder/title，并有原样组件的兼容fallback。原样工具 disclosure 使用 native summary；若替换了该机制且无法定位，返回blocked供复核。评分要求的是行为，不是指定 CSS/class。

## 确定性、隔离与局限

全新context、UTC、zh-CN、固定浏览器wall clock、减弱动画、禁用service worker。保留真实mock查询/流事件，不改协议。只允许本次loopback origin，拦截一个已知CDN图标请求为空JS，其余外部browser requests全部阻止。未获取/执行远端图标脚本。

订阅泄漏和初始历史竞态仅记录diagnostics；不计分。强制滚底行为属于已知上游问题，当前脚本不声称测试了所有scroll语义。新建/上传后端原本没有配置，不暗加要求。

Browser interception不能约束Vite构建或judge进程联网，必须依赖真正容器隔离。只执行可信来源安装的依赖；候选项目仍是不可信可执行代码。

Desktop search assertions are scoped to `data-testid="session-list"` because the current conversation title also remains visible in the separate header. After a session click the runner waits for that conversation's loaded history. History and long-content presence use DOM textContent because the existing message component uses `content-visibility: auto`; bounding checks still scroll each target into view.

The code adapter replaces a provisional `not_run` placeholder when its browser check completes, so the final result reflects observed pass/fail status rather than a stale placeholder.
