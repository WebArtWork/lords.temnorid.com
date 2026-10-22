const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('C:/Users/waw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root = path.resolve('dist/app/browser');
const capture = fs.readFileSync('output/seo-review/capture.js', 'utf8');
const types = {'.js':'text/javascript','.css':'text/css','.json':'application/json','.html':'text/html','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml'};
const server = http.createServer((req,res)=>{
	let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
	if (!file.startsWith(root + path.sep) && file !== root) {res.writeHead(403).end(); return;}
	if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
	if (!fs.existsSync(file)) {res.statusCode=404;file=path.join(root,'404.html');}
	res.setHeader('Content-Type',types[path.extname(file)] || 'application/octet-stream');
	fs.createReadStream(file).pipe(res);
});
(async()=>{
	await new Promise(resolve=>server.listen(4317,'127.0.0.1',resolve));
	const browser = await chromium.launch({headless:true,channel:'msedge'});
	try {
		const page = await browser.newPage();
		const errors=[];
		page.on('pageerror',error=>errors.push(error.message));
		const states=[];
		for (const width of [390,1440,1728]) {
			await page.setViewportSize({width,height:1000});
			await page.goto('http://127.0.0.1:4317/',{waitUntil:'networkidle'});
			await page.getByRole('heading',{name:'Лорди',exact:true}).waitFor();
			await page.evaluate(()=>document.fonts.ready);
			await page.screenshot({path:`output/seo-review/home-${width}.png`,fullPage:true});
			const meta = await page.evaluate(()=>({title:document.title,canonical:document.querySelector('link[rel="canonical"]').href,og:document.querySelector('meta[property="og:url"]').content,image:document.querySelector('meta[property="og:image"]').content,overflow:document.documentElement.scrollWidth>innerWidth,schema:!!document.querySelector('#project-schema')}));
			assert(meta.title.includes('фентезі-стратегія'));
			assert.equal(meta.canonical,'https://lords.temnorid.com/');
			assert.equal(meta.canonical,meta.og);
			assert(meta.image.endsWith('/seo/home.jpg') && meta.schema);
			assert(!meta.overflow,`overflow at ${width}`);
			states.push(await page.evaluate(capture));
		}
		// No-JavaScript crawlers receive page-specific metadata on every direct route.
		const crawler=await browser.newContext({javaScriptEnabled:false});
		for (const route of ['onboarding','village','farm','world']) {
			const tab=await crawler.newPage();
			await tab.goto(`http://127.0.0.1:4317/${route}/`);
			assert.equal(await tab.locator('meta[property="og:image"]').getAttribute('content'),`https://lords.temnorid.com/seo/${route}.jpg`);
			assert((await tab.locator('meta[name="robots"]').getAttribute('content')).includes('noindex'));
			await tab.close();
		}
		fs.writeFileSync('output/seo-review/spacing-states.json',JSON.stringify(states));
		fs.writeFileSync('output/seo-review/browser-results.json',JSON.stringify({widths:[390,1440,1728],crawlerRoutes:4,errors},null,2));
		assert.deepEqual(errors,[]);
		console.log('Browser checks passed: 3 widths, hydrated metadata, schema, no overflow, 4 crawler routes, no page errors.');
	} finally {await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
