import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (name) => readFileSync(new URL(name, root), 'utf8');
const html = read('index.html');
const css = read('style.css');
const js = read('app.js');
new Script(js, { filename: 'app.js' });
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique');
assert.equal([...html.matchAll(/data-effect="[0-4]"/g)].length, 5);
for (let i = 0; i < 5; i++) assert(ids.includes('effect-' + i));
assert(html.includes('lang="zh-CN"'));
assert(html.includes('src="app.js"') && html.includes('href="style.css"'));
assert(css.includes('[hidden]') && css.includes('prefers-reduced-motion'));
assert(!/<(?:script|img)\b[^>]*src=["']https?:/i.test(html), 'Runtime assets must be local');
assert(!/@import|url\(\s*["']?https?:/i.test(css), 'No remote CSS imports/assets');
assert(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(js), 'No runtime network client');
for (const name of ['orchid-background-v2.png', 'person-foreground-v2.png']) {
  const path = 'assets/' + name;
  assert(html.includes(path), 'Required image must be referenced');
  const data = readFileSync(new URL(path, root));
  assert(data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  let pos = 8, end = false, imageData = false;
  while (pos + 12 <= data.length) {
    const size = data.readUInt32BE(pos);
    assert(pos + size + 12 <= data.length, 'Invalid PNG chunk length');
    const type = data.toString('ascii', pos + 4, pos + 8);
    assert(!['tEXt','zTXt','iTXt','eXIf'].includes(type), 'Unexpected metadata in public image');
    if (type === 'IDAT') imageData = true;
    pos += size + 12;
    if (type === 'IEND') { end = true; break; }
  }
  assert(end && imageData && pos === data.length, 'Invalid PNG container');
}
console.log('Static checks passed: syntax, IDs, five panels, local resources and PNG containers.');
console.log('Browser interaction checks are still required; this script does not render the page.');
