const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const routes=['index.html','404.html','work/homelab/index.html','work/classquest/index.html','work/luna/index.html'];
let checked=0;const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
for(const rel of routes){const html=read(rel);assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,rel+' must have one h1');assert.match(html,/<main id="main"/);assert.match(html,/<html lang="en-AU"/);assert.match(html,/<meta name="description"/);assert.match(html,/<meta property="og:image"/);assert.match(html,/<meta name="twitter:image"/);assert.doesNotMatch(html,/motion-toggle|Pause motion|Play motion/,rel+' must not expose a global motion control');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate IDs '+rel);
for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){const ref=match[1];if(/^(?:https?:|mailto:|data:)/.test(ref))continue;const u=new URL(ref,'https://local/'+rel.replace(/index.html$/,''));let file=path.join(root,decodeURIComponent(u.pathname));assert.ok(fs.existsSync(file),'Missing '+ref+' in '+rel);if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(u.hash&&file.endsWith('.html')){const target=fs.readFileSync(file,'utf8');assert.ok(target.includes('id="'+decodeURIComponent(u.hash.slice(1))+'"'),'Missing fragment '+ref+' in '+rel);}checked++;}
assert.ok(!/https:\/\/fonts\./.test(html),'External font service remains');
for(const im of html.matchAll(/<img\b[^>]+>/g)){assert.match(im[0],/\balt="[^"]*"/);assert.match(im[0],/\bwidth="\d+"/);assert.match(im[0],/\bheight="\d+"/);}}
for(const m of read('css/site.css').matchAll(/url\(['"]?([^)'"\s]+)/g)){if(m[1].startsWith('data:'))continue;assert.ok(fs.existsSync(path.resolve(root,'css',m[1])),'Missing CSS asset '+m[1]);checked++;}
const home=read('index.html'),lab=read('work/homelab/index.html'),quest=read('work/classquest/index.html'),luna=read('work/luna/index.html');
assert.match(home,/update pending/);assert.match(home,/subject to student visa conditions/);assert.match(home,/role="log"/);
assert.match(home,/Field notes<br>2026 edition/);assert.doesNotMatch(home,/Vol\. 01/);
assert.match(home,/train in boxing/);assert.match(home,/beginner on guitar/);
assert.equal((home.match(/data-offshift-tab=/g)||[]).length,4,'Homepage must contain four off-shift selectors');
assert.equal((home.match(/data-offshift-note=/g)||[]).length,4,'Homepage must keep four off-shift notes without JavaScript');
assert.match(home,/Off shift \/ Four notes/);assert.match(home,/The rules stay the same, but the position keeps changing\./);
assert.match(home,/class="background-index"/);assert.match(home,/class="background-ledger"/);assert.match(home,/Tools in use/);assert.match(home,/Identity and automation/);
assert.match(lab,/Illustrative, not a recorded incident/);assert.match(lab,/OpenSearch/);assert.ok(!/two seconds|real speed|Elasticsearch-based|Kibana-based/i.test(lab));
assert.equal((lab.match(/data-flow-packet/g)||[]).length,3,'Lab must contain three telemetry packets');
assert.deepEqual([...lab.matchAll(/data-flow-step="(\d)"/g)].map(match=>match[1]),['1','2','3'],'Telemetry packets must be ordered');
assert.equal((lab.match(/data-trace-step/g)||[]).length,5,'Illustrative trace must contain five rows');
assert.deepEqual([...lab.matchAll(/data-trace-step="(\d)"/g)].map(match=>match[1]),['1','2','3','4','5'],'Trace rows must be ordered');
assert.match(lab,/Teaching example, not live telemetry/);
for(const n of [5,11,12,14,20,21,23,24,25,26])assert.ok(quest.includes('/pull/'+n+'"'),'Missing PR '+n);
assert.match(luna,/Zhirui/);assert.match(luna,/vendor routine/);
const siteScript=read('js/site.js');
assert.ok(!/\beval\s*\(|new Function|\.innerHTML\s*=/.test(siteScript),'Unsafe terminal rendering primitive');
assert.doesNotMatch(siteScript,/bs-motion/,'Motion state must not be persisted');
assert.match(read('404.html'),/<meta name="robots" content="noindex">/);
console.log(`PASS: ${routes.length} pages, ${checked} local resources/fragments, metadata, factual boundaries and safe terminal primitives.`);
