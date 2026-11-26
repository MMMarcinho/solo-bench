import {setTimeout as delay} from 'node:timers/promises';

// Keep the next UI action from hiding a delayed commit of the obsolete result.
export const stalePreviewWindowMs = 350;

export async function observeStaleResponse(page, release, currentTitle, obsoleteTitle) {
  const watch = await page.evaluateHandle(({currentTitle, obsoleteTitle}) => {
    let unexpected = null;
    const sample = () => {
      if (unexpected) return;
      const status = document.querySelector('[data-testid="template-status"]')?.getAttribute('data-state');
      const preview = document.querySelector('[data-testid="template-preview"]');
      const text = preview?.innerText || '';
      if (status !== 'ready' || !text.includes(currentTitle) ||
          !text.includes(currentTitle + ' description') || text.includes(obsoleteTitle)) {
        unexpected = {status: status ?? null, preview: text.slice(0, 200)};
      }
    };
    // Observe the document, not an element that may be replaced by a rerender.
    const observer = new MutationObserver(sample);
    observer.observe(document, {childList: true, subtree: true, attributes: true, characterData: true});
    sample();
    return {
      stop() {
        observer.disconnect();
        sample();
        return unexpected;
      },
    };
  }, {currentTitle, obsoleteTitle});
  let unexpected;
  try {
    await release();
    await delay(stalePreviewWindowMs);
  } finally {
    try { unexpected = await watch.evaluate(w => w.stop()); }
    finally { await watch.dispose(); }
  }
  if (unexpected) throw Error('Old success changed the active preview during the observation window: ' + JSON.stringify(unexpected));
}
