# Chatbot Baseline · Desktop Design Revision

一个可独立运行的 Vite + React Chatbot 示例工程。项目包含会话列表、消息展示、Markdown、代码块、附件、工具调用、输入区和浏览器内存 mock，不依赖后端服务或外部网络。

当前源码为 `01-chatbot-local-design-avatar-v2`：从上游基线提炼已有聊天组件，补充与本地组件参考一致的桌面工作区层级。只在宽屏显示新增的桌面品牌栏和会话标题区；移动端适配仍是 benchmark 任务。上游逐字快照及来源见父目录 `PROVENANCE.md`。

## 本地运行

```bash
npm ci --ignore-scripts --legacy-peer-deps
npm run dev
```

默认地址：`http://127.0.0.1:4173/`。

## 生产构建

```bash
npm run build
```
