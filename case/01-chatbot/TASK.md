# Case 01 — Chatbot 移动端适配 / Mobile adaptation

你接手的是一个可独立运行的 Vite + React + TypeScript 聊天界面。请在现有实现上完成移动端适配，保留桌面端的交互和内容层级。

当前基线是以原始 chatbot-baseline 为基础、参考用户本地组件视觉语言完成的桌面版设计衍生稿；原始版本可由 `case.json` 中的上游 commit 追溯。桌面新增的品牌栏、标题区和留白层级是需要保留的基线内容，不是手机布局答案。窄屏布局仍需你完成。

## 目标

以 `attachment/iphone-16-pro-chat-preview.png`、`iphone-16-pro-chat-drawer-preview.png` 和 `iphone-16-pro-chat-detail-preview.png` 为移动端设计参考；同目录 HTML/CSS 是静态设计导出，可用于理解布局。

1. 窄屏默认展示完整的单会话主视图。会话列表从左侧抽屉进入，可打开、关闭、点遮罩关闭；选择会话后关闭抽屉。保留搜索、清空搜索、置顶和当前选中态。
2. 保持消息区独立纵向滚动，输入区始终可触达，不被页面裁切。适应不同手机尺寸、横屏、平板和窗口缩放。
3. 长链接、长文件名文字、Markdown、代码块和可展开的工具调用都应可读，不能撑破或被粗暴裁切在页面边缘。代码可以在自身容器内水平滚动。
4. 输入和发送仍使用现有本地 mock：发送一条用户消息后清空输入。不得新增在线模型依赖、登录、密钥或后端服务。
5. 保留桌面端的双栏布局、会话切换、搜索、置顶、消息、工具详情和输入功能。桌面端不需要照搬手机设计。
6. 新增的导航和抽屉应有可理解的标签、键盘操作、焦点处理和合适的触摸面积；考虑真实手机浏览器的安全区与软键盘。

参考手机尺寸包括 360×800、390×844、402×874、430×932 CSS 像素；还会查看 768×1024、844×390、1280×900 和 1440×900。断点和实现方式由你决定。设计稿里的系统状态栏、Dynamic Island、Home indicator、假消息、假标题、示例文件和静态时间不是要复制到网页里的功能。保持实际 mock 的内容，参考布局层级与视觉风格。

## 范围边界

- 可以修改组件、布局、样式和必要的 UI 状态，增补合理的测试。
- 不要把应用替换为静态设计 HTML，也不要删除消息/工具内容或禁用原有功能来避免溢出。
- `src/eval/mockConversation.ts` 是固定输入，请保持其内容不变。保留已有 `data-testid="eval-viewport"`、`data-testid="session-list"`、`data-testid="conversation"`、`data-conversation-id`、`data-loading` 以及现有 mock 调试接口。可移动这些属性到语义相同的元素，但不能伪造状态。
- 现有“新建会话”回调未实现，上传未配置，消息历史中的附件是文件名文字；本题不要求新增这几项后端/上传功能。若已有附件组件在你的流程中显示，也应合理适配。
- 基线已有快速会话切换竞态、订阅未清理和强制滚到底部问题。本题不要求额外修复这些独立问题；不要引入新的回归。可修复，但无需为了本题重写会话协议。
- 不要访问评分器、修改固定输入、添加真实凭据或依赖外部网络。

## 交付

提交候选源码修改，保持基线兼容的 TypeScript 检查和 Vite 构建。基线缺少 `@types/node`，干净安装后 `npm run build` 会在 `vite.config.ts` 的 `node:path` / `__dirname` 类型上报两个已知错误；这不是本题要求额外修复的移动端问题。可以补齐 devDependency，但不能引入新的类型或构建错误。简述修改和实际执行的验证，说明没有验证的真实设备/键盘行为。无需部署、推送或创建 PR。

English summary: adapt the existing app for mobile using the supplied visual references, preserve desktop functionality and offline fixtures, and make the mobile drawer, message content and composer usable. Do not copy decorative phone chrome or static reference data. Existing unrelated runtime bugs and unconfigured backend/upload actions are outside scope.
