export function toXml(tag: string, fields: Record<string, string | number | null | undefined>): string {
  const inner = Object.entries(fields)
    .map(([k, v]) => `  <${k}>${escape(v)}</${k}>`)
    .join('\n');
  return `<${tag}>\n${inner}\n</${tag}>`;
}

export function wrapXmlDocument(rootTag: string, items: string[], meta: Record<string, string>): string {
  const metaXml = Object.entries(meta)
    .map(([k, v]) => `  <${k}>${escape(v)}</${k}>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<${rootTag}>\n<Header>\n${metaXml}\n</Header>\n<Records>\n${items.join('\n')}\n</Records>\n</${rootTag}>`;
}

function escape(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
