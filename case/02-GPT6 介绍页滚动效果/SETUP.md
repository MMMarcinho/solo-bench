# 运行方式

从 benchmark 根目录创建独立候选，并只将候选目录与 `TASK.md`、本文件交给待测 agent：

```bash
python3 tools/create-candidate.py --case '02-GPT6 介绍页滚动效果' /tmp/gpt6-scroll-candidate
python3 -m http.server 4173 --directory /tmp/gpt6-scroll-candidate
```

浏览器打开 `http://127.0.0.1:4173/`。页面不需要安装依赖或访问外部服务。starter 只提供语义内容、最基本的排列和公开定位锚点；`motion.js` 全部待实现，目标视觉层级和动画也没有预先完成。评测在 1180 × 757、390 × 844、resize 与 reduced-motion 条件下检查真实渲染、滚动暂停与回滚。参考实现和 grader 必须留在候选环境之外。
