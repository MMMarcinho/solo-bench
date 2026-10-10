# Case 01 来源与设计衍生记录

## 上游基线

- 上游：`https://github.com/MMMarcinho/chatbot-baseline`，commit `609b54a171d6536357810ec9baf1d0785c30fff1`，2026-10-09 UTC 获取。
- 原始 commit 含升级前的 73 个 tracked 文件。公开仓库仅包含当前设计衍生基线；开发机上的旧压缩备份和原始验证日志不公开。

## 当前交付的来源

- 当前 `case/01-chatbot/source/` 是本地修订 `01-chatbot-local-design-avatar-v2`；`case.json` 的 `source.commit` 为 `null`，不会将修改后的文件冒充上游 commit。`source.upstream_commit` 仅表明衍生来源。
- 本次新增桌面工作区框架、会话栏品牌层级和会话标题区；保留原有离线 mock、消息组件、交互与手机设计参考。没有完成移动端抽屉、窄屏排布或内容溢出适配。
- 视觉参考是用户本机只读的组件仓库。我们只提炼了其浅色背景、靛蓝强调色、轻量边框和输入区层级等视觉语言；未复制其私有源码、图片、字体或其它素材。原有上游基线自身已有同色系聊天组件。
- 用户提供的两张生成 PNG（人物和机器人）保留在根目录 `assets/`，并复制到 `source/src/assets/` 供 Vite 离线打包。未使用只读视觉参考仓库的图片。
- `source.sha256.json` 锁定当前 75 个源文件。评分器输出 `source_revision` 和 `upstream_commit`；旧字段 `source_commit` 为 `null`。修改源代码后须重算 hash manifest 并更新 revision。

## 许可与隐私

上游没有明确 LICENSE；本地视觉参考也未确认可再分发许可。仓库所有者已授权在此公开项目中使用其基线源码与本次生成的头像，但本仓库并未因此授予其他人开源许可证。没有引入参考仓库的私有源码、私有服务地址、凭据或真实聊天记录。基线原有示例会话仍由离线 mock 提供，未读取密钥。源码保留一个指向公开阿里 CDN 图标脚本的运行时 URL，并未在仓库中分发该脚本本体；该外部服务及其素材的使用权不由本文授予。
