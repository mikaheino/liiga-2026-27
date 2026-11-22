// lib/markdown.ts (23.11.2026, katselmointi XSS): linkit eivät voi tuoda HTML:ää eivätkä vaarallisia osoitteita.
import { test } from "node:test";
import assert from "node:assert/strict";
import { md, safeHref } from "../lib/markdown.ts";

const noRawHtml = (h: string) => {
  const stripped = h.replace(/<\/?(p|b|a|ul|li|h4|table|thead|tbody|tr|th|td)( href="[^"<>]*"( target="_blank" rel="noopener noreferrer")?)?>/g, "");
  assert.ok(!/[<>]/.test(stripped), `raakaa HTML:ää: ${h}`);
};

test("percent-encoded tags and quotes stay escaped in autolinks", () => {
  for (const p of ["https://x.fi/%3Cimg%20src=x%20onerror=alert(1)%3E", "https://x.fi/%22onmouseover=%22alert(1)",
                   "https://x.fi/%3Cscript%3Ealert(1)%3C/script%3E", "https://x.fi/%E0%A4%A"]) {
    const h = md(`katso ${p}`);
    noRawHtml(h);
    assert.ok(!h.includes('"onmouseover'), h);
  }
});

test("javascript: and data: never become links", () => {
  for (const p of ["[klikkaa](javascript:alert(1))", "[x](data:text/html;base64,PHNjcmlwdD4=)", "[x](JaVaScRiPt:alert(1))",
                   "[x](//evil.example/a)", "[x](/../../etc)"]) {
    const h = md(p);
    assert.ok(!/<a /.test(h), h);
    noRawHtml(h);
  }
  assert.equal(safeHref("javascript:alert(1)"), null);
  assert.equal(safeHref("data:text/html,x"), null);
});

test("markdown link text and href are escaped", () => {
  const h = md('[<b onclick=x>"t"</b>](https://yle.fi/a?b="c"&d=<e>)');
  noRawHtml(h);
  assert.match(h, /<a href="https:\/\/yle\.fi\/a\?b=%22c%22&amp;d=%3Ce%3E" target="_blank" rel="noopener noreferrer">&lt;b onclick=x&gt;&quot;t&quot;&lt;\/b&gt;<\/a>/);
});

test("ordinary links, internal paths and bold still work", () => {
  assert.equal(md("**HPK** voittaa: /joukkue/HPK"), '<p><b>HPK</b> voittaa: <a href="/joukkue/HPK">/joukkue/HPK</a></p>');
  assert.equal(md("lue https://yle.fi/urheilu"), '<p>lue <a href="https://yle.fi/urheilu" target="_blank" rel="noopener noreferrer">https://yle.fi/urheilu</a></p>');
  assert.equal(md("ja/tai"), "<p>ja/tai</p>");
  assert.equal(md("a < b"), "<p>a &lt; b</p>");
});
