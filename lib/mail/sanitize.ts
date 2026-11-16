/**
 * sanitize.ts: untrusted mail HTML/plain-text sanitation (SERVER-ONLY).
 *
 * Every message body rendered in the app passes through `sanitizeMessageHtml`
 * before it reaches an <iframe srcDoc>. Nothing is ever rendered raw.
 *
 * Allowlist (anything else is dropped):
 *   tags:  p br b strong em i u s ul ol li blockquote pre code h1 h2 h3 h4 hr
 *          table thead tbody tr td th span div a img
 *   attrs: a[href,target,rel]  img[src,alt,width,height]   (nothing global)
 *   href protocols: http https mailto only · img src: http https data:image/* only
 *   every <a> is forced to target="_blank" rel="noopener noreferrer"
 *   FORBIDDEN (never in allowlist): script style iframe object embed form input
 *   button link meta base + all on* handlers (sanitize-html strips them all
 *   because they are not in allowedAttributes)
 *
 * Cap: input longer than MAX_HTML_LENGTH is truncated with a visible marker.
 */
import "server-only";
import sanitizeHtml from "sanitize-html";

/** Hard cap for a single message body. Anything longer is truncated. */
export const MAX_HTML_LENGTH = 1_000_000;
const TRUNCATION_MARKER =
  '<hr><p><strong>This message was truncated: it exceeded the 1&nbsp;MB safety limit.</strong></p>';

const ALLOWED_TAGS = [
  "p", "br", "b", "strong", "em", "i", "u", "s",
  "ul", "ol", "li", "blockquote", "pre", "code",
  "h1", "h2", "h3", "h4", "hr",
  "table", "thead", "tbody", "tr", "td", "th",
  "span", "div", "a", "img",
];

const DATA_IMAGE_RE = /^data:image\/(png|gif|jpe?g|webp|avif);base64,[a-z0-9+/=\s]+$/i;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
  },
  // Global protocol allowlist: http(s) + mailto only (covers a[href]).
  allowedSchemes: ["http", "https", "mailto"],
  // img additionally may use data: (restricted to data:image/* by the regex above).
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedSchemesAppliedToAttributes: ["href", "src"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer",
      },
    }),
    img: (tagName, attribs) => {
      const src = typeof attribs.src === "string" ? attribs.src.trim() : "";
      const isHttp = /^https?:\/\//i.test(src);
      const isDataImage = DATA_IMAGE_RE.test(src);
      const cleaned: Record<string, string> = {};
      if (src && (isHttp || isDataImage)) cleaned.src = src;
      if (typeof attribs.alt === "string") cleaned.alt = attribs.alt.slice(0, 512);
      for (const dim of ["width", "height"] as const) {
        const v = attribs[dim];
        if (typeof v === "string" && /^\d{1,4}$/.test(v.trim())) cleaned[dim] = v.trim();
      }
      return { tagName, attribs: cleaned };
    },
  },
};

/**
 * Sanitize an untrusted HTML mail body. Input is truncated to MAX_HTML_LENGTH
 * (with a visible warning marker appended) before sanitizing.
 */
export function sanitizeMessageHtml(html: string): string {
  if (typeof html !== "string") return "";
  let input = html;
  let truncated = false;
  if (input.length > MAX_HTML_LENGTH) {
    input = input.slice(0, MAX_HTML_LENGTH);
    truncated = true;
  }
  const clean = sanitizeHtml(input, OPTIONS);
  return truncated ? `${clean}${TRUNCATION_MARKER}` : clean;
}

/** HTML-escape a plain-text string so it can be embedded in markup/srcDoc. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Escape a plain-text mail body for safe interpolation as text. */
export function sanitizePlain(text: string): string {
  if (typeof text !== "string") return "";
  return escapeHtml(text);
}
