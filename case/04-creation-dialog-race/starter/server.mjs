import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';

const templates = {
  studio: { id: 'studio', title: '创作工作室', description: '带素材板与草稿区，适合内容制作。' },
  lab: { id: 'lab', title: '实验小组', description: '带实验记录与结果看板，适合快速验证。' },
};
const files = new Map([
  ['/', ['index.html', 'text/html']],
  ['/style.css', ['style.css', 'text/css']],
  ['/app.mjs', ['app.mjs', 'text/javascript']],
]);
let nextId = 1;
function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  try {
    if (req.method === 'GET' && files.has(path)) {
      const [fn, type] = files.get(path);
      const body = await readFile(new URL(fn, import.meta.url));
      res.writeHead(200, { 'content-type': type + '; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(body);
    }
    const template = /^\/api\/templates\/(studio|lab)$/.exec(path)?.[1];
    if (req.method === 'GET' && template) {
      await sleep(template === 'studio' ? 1200 : 150);
      return json(res, 200, templates[template]);
    }
    if (req.method === 'POST' && path === '/api/projects') {
      let unparsed = '';
      for await (const chunk of req) {
        unparsed += chunk;
        if (unparsed.length > 8192) return json(res, 413, { error: '请求过大' });
      }
      let data;
      try { data = JSON.parse(unparsed); }
      catch { return json(res, 400, { error: '无效 JSON' }); }
      if (!data || typeof data !== 'object') return json(res, 400, { error: '表单无效' });
      const { mode, name, seats, templateId } = data;
      const keys = Object.keys(data).sort().join(',');
      const manual = mode === 'manual' && keys === 'mode,name,seats' &&
        Number.isInteger(seats) && seats >= 1 && seats <= 20;
      const fromTemplate = mode === 'template' && keys === 'mode,name,templateId' &&
        typeof templateId === 'string' && Object.hasOwn(templates, templateId);
      if (typeof name !== 'string' || !name.trim() || !(manual || fromTemplate)) {
        return json(res, 400, { error: '请检查创建参数' });
      }
      return json(res, 201, { id: String(nextId++), name: name.trim(), mode });
    }
    json(res, 404, { error: '未找到' });
  } catch {
    json(res, 500, { error: '本地服务错误' });
  }
});
server.listen(Number(process.env.PORT ?? 4174), '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${server.address().port}`);
});
