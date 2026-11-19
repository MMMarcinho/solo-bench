const get = (id) => document.querySelector(`[data-testid="${id}"]`);
const dialog = get('create-dialog');
const form = document.querySelector('#create-form');
const nameInput = get('name');
const seats = get('seats');
const template = get('template');
const status = get('template-status');
const preview = get('template-preview');
const submit = get('submit');
const result = get('create-result');
const submitError = document.querySelector('#submit-error');
const retry = get('retry-template');
let state = 'idle';
let details = null;
let submitting = false;
let epoch = 0;

const mode = () => form.elements.mode.value;

function render() {
  const usingTemplate = mode() === 'template';
  document.querySelector('#manual-fields').hidden = usingTemplate;
  document.querySelector('#template-fields').hidden = !usingTemplate;
  seats.disabled = usingTemplate;
  template.disabled = !usingTemplate;
  status.dataset.state = state;
  status.textContent = {
    idle: '', loading: '正在加载模板…', ready: '模板已就绪', error: '模板加载失败，请重试。',
  }[state];
  retry.hidden = state !== 'error';
  preview.hidden = state !== 'ready';
  preview.replaceChildren();
  if (details && state === 'ready') {
    const title = document.createElement('strong');
    title.textContent = details.title;
    const description = document.createElement('p');
    description.textContent = details.description;
    preview.append(title, description);
  }
  submit.disabled = submitting || !nameInput.value.trim() ||
    (usingTemplate ? !template.value || state !== 'ready' : !seats.value || !seats.validity.valid);
}

async function loadTemplate() {
  details = null;
  state = mode() === 'template' && template.value ? 'loading' : 'idle';
  render();
  if (state !== 'loading') return;
  const selected = template.value;
  // Baseline deliberately leaves concurrent requests unsynchronized.
  try {
    const response = await fetch(`/api/templates/${encodeURIComponent(selected)}`, { cache: 'no-store' });
    if (!response.ok) throw new Error('模板请求失败');
    details = await response.json();
    state = 'ready';
  } catch {
    details = null;
    state = 'error';
  }
  render();
}

get('open-create').addEventListener('click', () => {
  epoch++;
  form.reset();
  details = null;
  state = 'idle';
  submitting = false;
  submitError.hidden = true;
  result.hidden = true;
  render();
  dialog.showModal();
  nameInput.focus();
});
get('cancel').addEventListener('click', () => dialog.close());
for (const id of ['mode-manual', 'mode-template', 'template']) {
  get(id).addEventListener('change', loadTemplate);
}
retry.addEventListener('click', loadTemplate);
nameInput.addEventListener('input', render);
seats.addEventListener('input', render);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  render();
  if (submit.disabled) return;
  const name = nameInput.value.trim();
  const payload = mode() === 'manual'
    ? { mode: 'manual', name, seats: seats.valueAsNumber }
    : { mode: 'template', name, templateId: details.id };
  const attempt = epoch;
  submitting = true;
  submitError.hidden = true;
  render();
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('创建失败');
    const project = await response.json();
    if (epoch !== attempt || !dialog.open) return;
    result.textContent = `已创建：${project.name}`;
    result.hidden = false;
    dialog.close();
  } catch {
    if (epoch !== attempt || !dialog.open) return;
    submitError.textContent = '创建失败，请重试。';
    submitError.hidden = false;
  } finally {
    if (epoch === attempt) {
      submitting = false;
      render();
    }
  }
});
render();
