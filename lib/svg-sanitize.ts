/**
 * svg-sanitize — minimal, dependency-free SVG sanitizer for user uploads.
 * Parses the SVG, drops anything executable, re-serializes. Returns null when
 * the input cannot be parsed as SVG (callers then refuse the file).
 *
 * Rendered inside <img>, SVG scripts would not execute anyway — this is
 * defense in depth against stored XSS through the public brand-assets bucket.
 */
const FORBIDDEN_TAGS = new Set([
  "script", "foreignobject", "iframe", "object", "embed", "audio",
  "video", "handler", "listener", "set",
]);

export function sanitizeSvg(svgText: string): string | null {
  if (typeof DOMParser === "undefined") return null; // SSR — callers run client-side
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  } catch {
    return null;
  }
  const errNode = doc.querySelector("parsererror");
  if (errNode) return null;
  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== "svg") return null;

  // Drop forbidden elements entirely
  const toRemove: Element[] = [];
  doc.querySelectorAll("*").forEach((el) => {
    if (FORBIDDEN_TAGS.has(el.tagName.toLowerCase())) toRemove.push(el);
  });
  for (const el of toRemove) el.parentNode?.removeChild(el);

  // Strip event handlers and javascript: references
  doc.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) el.removeAttribute(attr.name);
      else if ((name === "href" || name === "xlink:href") && value.startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    }
  });

  // Remove external resource references (fonts/images via CSS or @import) — keep data/inline only
  const styleEls = doc.querySelectorAll("style");
  styleEls.forEach((styleEl) => {
    const css = styleEl.textContent ?? "";
    if (/@import|url\(\s*['"]?\s*(https?:|\/\/|\\)/i.test(css)) styleEl.remove();
  });

  return new XMLSerializer().serializeToString(root);
}
