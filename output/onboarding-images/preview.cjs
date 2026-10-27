const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = process.cwd();
const component = fs.readFileSync('src/app/pages/onboarding/onboarding.component.ts', 'utf8');
const sourceCard = component.match(/<label\s[\s\S]*?<\/label>/)[0];
const styles = component.match(/styles: `([\s\S]*?)`/)[1];
const ua = JSON.parse(fs.readFileSync('src/i18n/ua.json'));
const en = JSON.parse(fs.readFileSync('src/i18n/en.json'));
const translate = text => en[ua.indexOf(text)] ?? text;
const data = fs.readFileSync('src/app/feature/element/element.data.ts', 'utf8');
const cards = [...data.matchAll(/id: '(stone|fire)',\s*name: '([^']+)',\s*description: '([^']+)',[\s\S]*?image: '([^']+)'/g)].map(([,id,name,description,image]) =>
	sourceCard
		.replace(/@if \(element.image\) \{([\s\S]*?)\} @else \{[\s\S]*?\n\s*\}/, '$1')
		.replace(/\s*\[class.choice-card--selected\]="[^"]*"/, '')
		.replace(/\s*\[checked\]="[^"]*"/, '')
		.replace(/\s*\(click\)="[^"]*"/, '')
		.replace('[value]="element.id"', `value="${id}"`)
		.replace('[src]="element.image"', `src="/${image}"`)
		.replace(/\s*\[translate\]="[^"]*"/g, '')
		.replace('{{ element.name }}', translate(name))
		.replace('{{ element.description }}', translate(description))
).join('\n');
if (!cards.includes('stone.webp') || !cards.includes('fire.webp')) throw Error('Card extraction failed');
const html = `<!doctype html><html lang="en" data-mode="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Onboarding image preview</title><link rel="stylesheet" href="/styles.css"><link href="https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@500;700&family=Alegreya+Sans:wght@400;500;700&family=Spectral:wght@400;600&family=Material+Symbols+Outlined&display=swap" rel="stylesheet"><style>${styles}</style></head><body><main style="height:calc(100dvh - 9rem);margin-top:4.5rem"><section class="onboarding mx-auto max-w-[var(--container)] px-4 sm:px-6 t-page"><h1 class="t-display">${translate('Оберіть стихію, на якій вона постане.')}</h1><form class="fit-form mt-6"><fieldset class="fit-fieldset"><legend class="sr-only">Element of the first location</legend><div class="grid gap-4 sm:grid-cols-2 md:h-full">${cards}</div></fieldset></form><div class="mt-2 min-h-7 md:shrink-0"></div></section></main></body></html>`;
fs.writeFileSync('output/onboarding-images/preview.html', html);
http.createServer((req,res)=>{
	const pathname = new URL(req.url,'http://localhost').pathname;
	if(pathname === '/') {res.setHeader('Content-Type','text/html');res.end(html);return;}
	const relative = pathname === '/styles.css' ? `dist/app/browser/${fs.readdirSync('dist/app/browser').find(name => /^styles.*\.css$/.test(name))}` : `src/assets${pathname}`;
	const file = path.resolve(root,relative);
	if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
	res.setHeader('Content-Type',file.endsWith('.css')?'text/css':'image/webp');
	fs.createReadStream(file).pipe(res);
}).listen(4318,'127.0.0.1',()=>console.log('Isolated preview of the actual onboarding card template: http://127.0.0.1:4318/'));
