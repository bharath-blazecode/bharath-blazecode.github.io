const fs=require('node:fs'),path=require('node:path');require('./verify.cjs');
const root=path.resolve(__dirname,'..'),out=path.join(root,'dist');
if(fs.existsSync(out)){const real=fs.realpathSync(out);if(real!==out)throw new Error('Refusing to replace redirected dist directory');fs.rmSync(out,{recursive:true});}
fs.mkdirSync(out,{recursive:true});
const entries=['index.html','404.html','favicon.svg','.nojekyll','robots.txt','sitemap.xml','css','js','assets','resume','work'];
for(const entry of entries)fs.cpSync(path.join(root,entry),path.join(out,entry),{recursive:true});
console.log('Built a complete static site in dist/. No network, credentials or runtime dependencies needed.');
