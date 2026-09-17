const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const routes=['index.html','404.html','work/homelab/index.html','work/classquest/index.html','work/luna/index.html'];
let checked=0;const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
for(const rel of routes){const html=read(rel);assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,rel+' must have one h1');assert.match(html,/<main id="main"/);assert.match(html,/<html lang="en-AU"/);assert.match(html,/<meta name="description"/);assert.match(html,/<meta property="og:image"/);assert.match(html,/<meta name="twitter:image"/);const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate IDs '+rel);
for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){const ref=match[1];if(/^(?:https?:|mailto:|data:)/.test(ref))continue;const u=new URL(ref,'https://local/'+rel.replace(/index.html$/,''));let file=path.join(root,decodeURIComponent(u.pathname));assert.ok(fs.existsSync(file),'Missing '+ref+' in '+rel);if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(u.hash&&file.endsWith('.html')){const target=fs.readFileSync(file,'utf8');assert.ok(target.includes('id="'+decodeURIComponent(u.hash.slice(1))+'"'),'Missing fragment '+ref+' in '+rel);}checked++;}
assert.ok(!/https:\/\/fonts\./.test(html),'External font service remains');
for(const im of html.matchAll(/<img\b[^>]+>/g)){assert.match(im[0],/\balt="[^"]*"/);assert.match(im[0],/\bwidth="\d+"/);assert.match(im[0],/\bheight="\d+"/);}}
for(const m of read('css/site.css').matchAll(/url\(['"]?([^)'"\s]+)/g)){if(m[1].startsWith('data:'))continue;assert.ok(fs.existsSync(path.resolve(root,'css',m[1])),'Missing CSS asset '+m[1]);checked++;}
const home=read('index.html'),lab=read('work/homelab/index.html'),quest=read('work/classquest/index.html'),luna=read('work/luna/index.html');
assert.match(home,/update pending/);assert.match(home,/subject to student visa conditions/);assert.match(home,/role="log"/);assert.match(lab,/Illustrative, not a recorded incident/);assert.match(lab,/OpenSearch/);assert.ok(!/two seconds|real speed|Elasticsearch-based|Kibana-based/i.test(lab));
for(const n of [5,11,12,14,20,21,23,24,25,26])assert.ok(quest.includes('/pull/'+n+'"'),'Missing PR '+n);
assert.match(luna,/Zhirui/);assert.match(luna,/vendor routine/);
assert.ok(!/\beval\s*\(|new Function|\.innerHTML\s*=/.test(read('js/site.js')),'Unsafe terminal rendering primitive');
assert.match(read('404.html'),/<meta name="robots" content="noindex">/);
console.log(`PASS: ${routes.length} pages, ${checked} local resources/fragments, metadata, factual boundaries and safe terminal primitives.`);
