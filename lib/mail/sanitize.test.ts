import { describe, expect, it } from "vitest";
import { sanitizeMessageHtml, sanitizePlain, MAX_HTML_LENGTH } from "./sanitize";
import { getDemoMessage } from "./demo-messages";

describe("sanitizeMessageHtml", () => {
  it("strips scripts and event handlers but keeps safe markup", () => {
    const dirty =
      '<p onclick="x()">Hello <strong>world</strong></p><script>alert(1)</script><iframe src="https://evil.example.com"></iframe>';
    const clean = sanitizeMessageHtml(dirty);
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("<iframe");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("<strong>world</strong>");
  });

  it("forces target=_blank and rel on links, http(s)/mailto only", () => {
    const clean = sanitizeMessageHtml(
      '<a href="https://example.com">ok</a><a href="javascript:alert(1)">bad</a><a href="mailto:a@b.c" rel="opener">mail</a>',
    );
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
    expect(clean).not.toContain("javascript:");
  });

  it("drops dangerous tags entirely", () => {
    const clean = sanitizeMessageHtml(
      '<style>body{display:none}</style><form action="/x"><input name="c"></form><object></object><embed><button>go</button>',
    );
    expect(clean).not.toMatch(/<(style|form|input|object|embed|button)\b/);
  });

  it("truncates oversized input with a warning marker", () => {
    const clean = sanitizeMessageHtml("a".repeat(MAX_HTML_LENGTH + 100));
    expect(clean.length).toBeLessThan(MAX_HTML_LENGTH + 500);
    expect(clean).toContain("truncated");
  });

  it("allows data: images but not data:text/html", () => {
    const clean = sanitizeMessageHtml(
      '<img src="data:image/png;base64,iVBORw0KGgo=" alt="ok"><img src="data:text/html;base64,PGI+" alt="bad">',
    );
    expect(clean).toContain("data:image/png;base64,iVBORw0KGgo=");
    expect(clean).not.toContain("data:text/html");
  });
});

describe("sanitizePlain", () => {
  it("escapes markup", () => {
    expect(sanitizePlain('<b>&"quotes"</b>')).toBe("&lt;b&gt;&amp;&quot;quotes&quot;&lt;/b&gt;");
  });
});

describe("demo fixtures", () => {
  it("message 903 arrives sanitized — script never reaches the pane", () => {
    const msg = getDemoMessage(903, "INBOX");
    expect(msg).not.toBeNull();
    expect(msg?.html).toBeTruthy();
    expect(msg?.html).not.toContain("<script");
    expect(msg?.html).not.toContain("onclick");
    expect(msg?.html).not.toContain("<iframe");
    expect(msg?.html).not.toContain("<form");
    expect(msg?.html).not.toContain("javascript:");
    expect(msg?.html).toContain("Salle Grande");
  });
});
