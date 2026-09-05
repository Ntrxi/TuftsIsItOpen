const rendered = new WeakMap<Element, string>();

/** Keep controls and links alive when only status text changes; skip unchanged sections entirely. */
export function updateHTML(root: Element, html: string): void {
  if (rendered.get(root) === html) return;
  const template = document.createElement('template');
  template.innerHTML = html;
  const focused = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : undefined;
  patch(root, template.content);
  if (focused && !focused.isConnected) {
    const replacement = Array.from(root.querySelectorAll<HTMLElement>('a, button')).find((el) =>
      el.tagName === focused.tagName && el.getAttribute('href') === focused.getAttribute('href') &&
      el.getAttribute('aria-label') === focused.getAttribute('aria-label'));
    replacement?.focus({ preventScroll: true });
  }
  rendered.set(root, html);
}

function patch(current: Node, next: Node): void {
  const desired = Array.from(next.childNodes);
  for (let i = 0; i < desired.length; i++) {
    const target = desired[i]!;
    const existing = current.childNodes[i];
    if (!existing) { current.appendChild(target.cloneNode(true)); continue; }
    if (existing.nodeType !== target.nodeType || existing.nodeName !== target.nodeName) {
      current.replaceChild(target.cloneNode(true), existing);
    } else if (existing instanceof Element && target instanceof Element) {
      for (const attr of Array.from(existing.attributes)) {
        if (!target.hasAttribute(attr.name) && attr.name !== 'aria-pressed') existing.removeAttribute(attr.name);
      }
      for (const attr of Array.from(target.attributes)) {
        if (attr.name !== 'aria-pressed' && existing.getAttribute(attr.name) !== attr.value) existing.setAttribute(attr.name, attr.value);
      }
      patch(existing, target);
    } else if (existing.nodeValue !== target.nodeValue) existing.nodeValue = target.nodeValue;
  }
  while (current.childNodes.length > desired.length) current.removeChild(current.lastChild!);
}
