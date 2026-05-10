function getSpyScript(backendUrl) {
  return `
(function() {
  if (window.__QA_STUDIO_SPY_ACTIVE__) return;
  window.__QA_STUDIO_SPY_ACTIVE__ = true;

  const overlay = document.createElement('div');
  overlay.id = '__qa_studio_highlight__';
  overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #5865F2;background:rgba(88,101,242,0.15);z-index:999999;transition:all 0.1s ease;display:none;';
  document.body.appendChild(overlay);

  const tooltip = document.createElement('div');
  tooltip.id = '__qa_studio_tooltip__';
  tooltip.style.cssText = 'position:fixed;z-index:999999;background:#1e1e1e;color:#e0e0e0;font-family:monospace;font-size:12px;padding:6px 10px;border-radius:4px;border:1px solid #5865F2;pointer-events:none;display:none;max-width:400px;word-wrap:break-word;';
  document.body.appendChild(tooltip);

  const banner = document.createElement('div');
  banner.id = '__qa_studio_banner__';
  banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;background:linear-gradient(135deg,#5865F2,#4752c4);color:white;text-align:center;padding:8px;font-family:sans-serif;font-size:13px;font-weight:600;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
  banner.textContent = '🔍 QA Studio Object Spy — Hover để xem phần tử, Ctrl+Click để capture | ESC để thoát';
  document.body.appendChild(banner);

  let currentElement = null;

  function computeXPath(el) {
    if (el.id) return '//*[@id="' + el.id + '"]';
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let index = 0;
      let sibling = current.previousSibling;
      while (sibling) {
        if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === current.nodeName) {
          index++;
        }
        sibling = sibling.previousSibling;
      }
      const tagName = current.nodeName.toLowerCase();
      const pathPart = index > 0 ? tagName + '[' + (index + 1) + ']' : tagName;
      parts.unshift(pathPart);
      current = current.parentNode;
    }
    return '/' + parts.join('/');
  }

  function computeCssSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
      let selector = current.nodeName.toLowerCase();
      if (current.id) {
        selector = '#' + CSS.escape(current.id);
        parts.unshift(selector);
        break;
      } else if (current.className && typeof current.className === 'string') {
        const classes = current.className.trim().split(/\\s+/).filter(c => c.length > 0);
        if (classes.length > 0) {
          selector += '.' + classes.map(c => CSS.escape(c)).join('.');
        }
      }
      const parent = current.parentNode;
      if (parent) {
        const siblings = Array.from(parent.children).filter(s => s.nodeName === current.nodeName);
        if (siblings.length > 1) {
          const idx = siblings.indexOf(current) + 1;
          selector += ':nth-of-type(' + idx + ')';
        }
      }
      parts.unshift(selector);
      current = current.parentNode;
    }
    return parts.join(' > ');
  }

  function getFrameInfo() {
    try {
      if (window.self !== window.top) {
        const frames = window.parent.document.querySelectorAll('iframe, frame');
        for (let i = 0; i < frames.length; i++) {
          try {
            if (frames[i].contentWindow === window) {
              return {
                tagName: frames[i].tagName.toLowerCase(),
                id: frames[i].id || null,
                name: frames[i].name || null,
                src: frames[i].src || null,
                index: i
              };
            }
          } catch(e) {}
        }
        return { isIframe: true, unknown: true };
      }
    } catch(e) {}
    return null;
  }

  function collectElementData(el) {
    const rect = el.getBoundingClientRect();
    const tagName = el.tagName.toLowerCase();
    const id = el.id || null;
    const name = el.getAttribute('name') || null;
    const className = el.className && typeof el.className === 'string' ? el.className.trim() : null;
    const textContent = (el.textContent || '').trim().substring(0, 100);
    const dataTestId = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || null;
    const attributes = {};
    for (const attr of el.attributes) {
      attributes[attr.name] = attr.value;
    }

    const locators = [];
    let priority = 1;
    if (id) locators.push({ type: 'id', value: id, priority: priority++, status: 'active' });
    if (dataTestId) locators.push({ type: 'data-testid', value: dataTestId, priority: priority++, status: 'active' });
    if (name) locators.push({ type: 'name', value: name, priority: priority++, status: 'active' });
    locators.push({ type: 'xpath', value: computeXPath(el), priority: priority++, status: 'active' });
    locators.push({ type: 'css', value: computeCssSelector(el), priority: priority++, status: 'active' });
    if (className) locators.push({ type: 'className', value: className, priority: priority++, status: 'active' });

    let autoId = tagName;
    const prefixMap = {
      button: 'btn', input: 'txt', a: 'lnk', select: 'sel',
      textarea: 'txa', img: 'img', label: 'lbl', h1: 'hdr',
      h2: 'hdr', h3: 'hdr', div: 'div', span: 'spn', form: 'frm'
    };
    const prefix = prefixMap[tagName] || tagName.substring(0, 3);
    if (id) {
      autoId = prefix + '_' + id.replace(/[^a-zA-Z0-9]/g, '_');
    } else if (name) {
      autoId = prefix + '_' + name.replace(/[^a-zA-Z0-9]/g, '_');
    } else if (textContent) {
      autoId = prefix + '_' + textContent.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
    } else {
      autoId = prefix + '_' + Date.now();
    }

    return {
      objectId: autoId,
      tagName,
      textContent,
      locators,
      attributes,
      parentFrame: getFrameInfo(),
      sourceUrl: window.location.href,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    };
  }

  function onMouseOver(e) {
    const el = e.target;
    if (el.id && el.id.startsWith('__qa_studio_')) return;
    currentElement = el;
    const rect = el.getBoundingClientRect();
    overlay.style.display = 'block';
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = rect.width + 'px';
    overlay.style.height = rect.height + 'px';
    const tag = el.tagName.toLowerCase();
    const idStr = el.id ? '#' + el.id : '';
    const classStr = el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
    tooltip.textContent = '<' + tag + idStr + classStr + '>';
    tooltip.style.display = 'block';
    tooltip.style.left = Math.min(rect.left, window.innerWidth - 410) + 'px';
    tooltip.style.top = Math.max(rect.bottom + 4, 40) + 'px';
  }

  function onClick(e) {
    if (!e.ctrlKey) return;
    e.preventDefault();
    e.stopPropagation();
    if (!currentElement) return;
    if (currentElement.id && currentElement.id.startsWith('__qa_studio_')) return;

    const data = collectElementData(currentElement);
    overlay.style.border = '3px solid #4CAF50';
    overlay.style.background = 'rgba(76,175,80,0.25)';
    setTimeout(() => {
      overlay.style.border = '2px solid #5865F2';
      overlay.style.background = 'rgba(88,101,242,0.15)';
    }, 500);

    fetch('${backendUrl}/api/spy/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(r => r.json())
      .then(() => {
        console.log('[QA Studio] Đã capture:', data.objectId);
      })
      .catch((err) => {
        console.error('[QA Studio] Lỗi gửi data:', err);
      });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') cleanup();
  }

  function cleanup() {
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);

    const el1 = document.getElementById('__qa_studio_highlight__');
    const el2 = document.getElementById('__qa_studio_tooltip__');
    const el3 = document.getElementById('__qa_studio_banner__');
    if (el1) el1.remove();
    if (el2) el2.remove();
    if (el3) el3.remove();

    window.__QA_STUDIO_SPY_ACTIVE__ = false;
    fetch('${backendUrl}/api/spy/stopped', { method: 'POST' }).catch(() => {});
  }

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);

  console.log('[QA Studio] Object Spy đã được kích hoạt. Ctrl+Click để capture, ESC để thoát.');
})();
  `;
}

module.exports = {
  getSpyScript
};
