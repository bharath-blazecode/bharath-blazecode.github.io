const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const routes=['index.html','404.html','work/homelab/index.html','work/classquest/index.html','work/luna/index.html','work/competitions/index.html'];
let checked=0;const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
for(const rel of routes){const html=read(rel);assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,rel+' must have one h1');assert.match(html,/<main id="main"/);assert.match(html,/<html lang="en-AU"/);assert.match(html,/<meta name="description"/);assert.match(html,/<meta property="og:image"/);assert.match(html,/<meta name="twitter:image"/);assert.doesNotMatch(html,/motion-toggle|Pause motion|Play motion/,rel+' must not expose a global motion control');const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate IDs '+rel);
for(const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){const ref=match[1];if(/^(?:https?:|mailto:|data:)/.test(ref))continue;const u=new URL(ref,'https://local/'+rel.replace(/index.html$/,''));let file=path.join(root,decodeURIComponent(u.pathname));assert.ok(fs.existsSync(file),'Missing '+ref+' in '+rel);if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(u.hash&&file.endsWith('.html')){const target=fs.readFileSync(file,'utf8');assert.ok(target.includes('id="'+decodeURIComponent(u.hash.slice(1))+'"'),'Missing fragment '+ref+' in '+rel);}checked++;}
assert.ok(!/https:\/\/fonts\./.test(html),'External font service remains');
for(const im of html.matchAll(/<img\b[^>]+>/g)){assert.match(im[0],/\balt="[^"]*"/);assert.match(im[0],/\bwidth="\d+"/);assert.match(im[0],/\bheight="\d+"/);}}
for(const m of read('css/site.css').matchAll(/url\(['"]?([^)'"\s]+)/g)){if(m[1].startsWith('data:'))continue;assert.ok(fs.existsSync(path.resolve(root,'css',m[1])),'Missing CSS asset '+m[1]);checked++;}
const home=read('index.html'),lab=read('work/homelab/index.html'),quest=read('work/classquest/index.html'),luna=read('work/luna/index.html');
assert.match(home,/Download résumé \(PDF\)/);assert.doesNotMatch(home,/update pending|needs updating|June 2026 résumé/);assert.match(home,/subject to student visa conditions/);assert.match(home,/role="log"/);
assert.match(home,/Field notes<br>2026 edition/);assert.doesNotMatch(home,/Vol\. 01/);
assert.match(home,/train in boxing/);assert.match(home,/beginner on guitar/);
assert.match(home,/class="background-index"/);assert.match(home,/class="background-ledger"/);assert.match(home,/Tools in use/);assert.match(home,/Identity and automation/);
assert.match(lab,/Illustrative, not a recorded incident/);assert.match(lab,/OpenSearch/);assert.ok(!/two seconds|real speed|Elasticsearch-based|Kibana-based/i.test(lab));
assert.equal((lab.match(/data-flow-packet/g)||[]).length,3,'Lab must contain three telemetry packets');
assert.deepEqual([...lab.matchAll(/data-flow-step="(\d)"/g)].map(match=>match[1]),['1','2','3'],'Telemetry packets must be ordered');
assert.equal((lab.match(/data-trace-step/g)||[]).length,5,'Illustrative trace must contain five rows');
assert.deepEqual([...lab.matchAll(/data-trace-step="(\d)"/g)].map(match=>match[1]),['1','2','3','4','5'],'Trace rows must be ordered');
assert.match(lab,/Teaching example, not live telemetry/);
for(const n of [5,11,12,14,20,21,23,24,25,26])assert.ok(quest.includes('/pull/'+n+'"'),'Missing PR '+n);
assert.match(luna,/Zhirui/);assert.match(luna,/vendor routine/);
assert.match(home,/Selected for QUT’s 2026–27 Vacation Research Experience Scheme/);assert.match(home,/starts on 2 November 2026/);assert.match(home,/Dr Gowri Ramachandran/);assert.doesNotMatch(home,/(started|began|commenced)[^.<]{0,40}(VRES|Vacation Research)/i,'The research placement has not started yet');
const comps=read('work/competitions/index.html');
const eventIds=[...comps.matchAll(/<section class="spine event" id="([a-z]+)"/g)].map(m=>m[1]);assert.deepEqual(eventIds,['downtime','byteme','csaw','holmes','hackathon','cimctf'],'Scoreboard events are missing or out of order');
const homeComps=(home.match(/<section class="shell competitions"[\s\S]*?<\/section>/)||[''])[0];assert.ok(homeComps,'Homepage competition teaser is missing');
const board=(homeComps.match(/<ul class="scoreboard"[\s\S]*?<\/ul>/)||[''])[0];const tileIds=[...board.matchAll(/href="work\/competitions\/#([a-z]+)"/g)].map(m=>m[1]);assert.equal(tileIds.length,4,'The teaser shows four headline results');for(const id of tileIds)assert.ok(eventIds.includes(id),'Teaser tile points at a missing event: '+id);
for(const fact of ['3rd','People’s Choice','15 teams','476th','1,629','1,097th','5,637']){assert.ok(board.includes(fact),'Teaser is missing '+fact);assert.ok(comps.includes(fact),'Scoreboard is missing '+fact);}
assert.deepEqual([...comps.matchAll(/<p class="event-result"><b>([^<]+)<\/b><span>([^<]+)<\/span>/g)].map(m=>m[1]+' | '+m[2]),['476th | of 1,629 ranked teams · 1,150 XP · Team SushiShield, with Alan Nguyen','189th | of 530 teams · Team SushiShield','1,097th | of 5,637 teams · 8 of 111 challenges · 825 points · Team SushiShield','Award | People’s Choice · 15 teams · ClassQuest','3rd | place overall · Team SushiShield'],'Scoreboard result lines changed; check them against the event pages and certificates');
assert.ok(comps.includes('189th')&&comps.includes('530 teams')&&homeComps.includes('189th of 530'),'CSAW result must match on both pages');
assert.match(comps,/Alan Nguyen/);assert.match(comps,/Akira Hasuo/);assert.match(comps,/Every placement here is a team result/);assert.match(homeComps,/Placements are team results/);
const byteme=(comps.match(/<section class="spine event" id="byteme"[\s\S]*?<\/section>/)||[''])[0];assert.ok(byteme);assert.match(byteme,/Certificate of participation/);assert.doesNotMatch(byteme,/\b\d[\d,]*(st|nd|rd|th)\b|\b(placed|ranked|ranking|finished)\b/i,'ByteMe is a participation certificate with no placement');assert.match(homeComps,/ByteMe CTF participation/);
assert.match(comps,/not a claim to have solved everything unaided/);assert.doesNotMatch((comps+homeComps).replace('not a claim to have solved everything unaided',''),/unaided|on my own|solo\b|single-handed|flawless|perfect score/i,'Competitions must not claim unaided or flawless work');
assert.match(comps,/used AI tools as a guide/);
const siteScript=read('js/site.js');
assert.ok(!/\beval\s*\(|new Function|\.innerHTML\s*=/.test(siteScript),'Unsafe terminal rendering primitive');
assert.doesNotMatch(siteScript,/bs-motion/,'Motion state must not be persisted');
assert.match(read('404.html'),/<meta name="robots" content="noindex">/);
console.log(`PASS: ${routes.length} pages, ${checked} local resources/fragments, metadata, factual boundaries and safe terminal primitives.`);
