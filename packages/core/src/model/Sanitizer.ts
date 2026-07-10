/** Whitelist-based HTML sanitizer. ALL inbound HTML (setContent, paste) passes through here. */

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'div', 'br', 'hr',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'code', 'sub', 'sup', 'span',
  'ul', 'ol', 'li', 'a', 'img',
  'table', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption', 'figure', 'figcaption'
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  '*': new Set(['style', 'class', 'id', 'dir', 'lang', 'title']),
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope'])
};

const ALLOWED_STYLES = new Set([
  'color', 'background-color', 'text-align', 'text-decoration',
  'font-weight', 'font-style', 'font-size', 'font-family', 'line-height',
  'margin-left', 'margin-right', 'padding-left', // indent + table alignment
  'width', 'height', 'vertical-align', 'border-width', 'border-color', 'padding', 'table-layout' // table/cell props & resize
]);

const URL_SCHEME_BLOCKLIST = /^\s*(javascript|vbscript|data(?!:image\/(png|gif|jpe?g|webp)))\s*:/i;

function cleanElement(el: Element): void {
  const tag = el.tagName.toLowerCase();

  // Attributes
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const allowed = ALLOWED_ATTRS['*']!.has(name) || ALLOWED_ATTRS[tag]?.has(name);
    if (!allowed || name.startsWith('on')) {
      el.removeAttribute(attr.name);
      continue;
    }
    if ((name === 'href' || name === 'src') && URL_SCHEME_BLOCKLIST.test(attr.value)) {
      el.removeAttribute(attr.name);
    }
  }

  // Style whitelist
  const style = el.getAttribute('style');
  if (style) {
    const kept = style
      .split(';')
      .map((d) => d.trim())
      .filter((d) => {
        const prop = d.split(':')[0]?.trim().toLowerCase();
        return prop && ALLOWED_STYLES.has(prop);
      })
      .join('; ');
    if (kept) el.setAttribute('style', kept);
    else el.removeAttribute('style');
  }
}

export function sanitize(html: string, doc: Document = document): string {
  const template = doc.createElement('template');
  template.innerHTML = html;
  const root = template.content;

  // Remove disallowed elements (keep children for unknown wrappers, drop dangerous subtrees)
  const DROP_ENTIRELY = new Set(['script', 'style', 'iframe', 'object', 'embed', 'form', 'meta', 'link', 'head', 'title']);
  const walker = (node: Element): void => {
    for (const child of Array.from(node.children)) walker(child);
    const tag = node.tagName.toLowerCase();
    if (DROP_ENTIRELY.has(tag)) {
      node.remove();
    } else if (!ALLOWED_TAGS.has(tag)) {
      // unwrap: keep content, drop wrapper (handles <o:p>, <w:sdt>, custom tags)
      const parent = node.parentNode;
      if (parent) {
        while (node.firstChild) parent.insertBefore(node.firstChild, node);
        node.remove();
      }
    } else {
      cleanElement(node);
    }
  };
  for (const child of Array.from(root.children)) walker(child);

  // Strip HTML comments (Word paste is full of them)
  const it = doc.createNodeIterator(root, NodeFilter.SHOW_COMMENT);
  let c: Node | null;
  const comments: Node[] = [];
  while ((c = it.nextNode())) comments.push(c);
  comments.forEach((n) => n.parentNode?.removeChild(n));

  return template.innerHTML;
}
