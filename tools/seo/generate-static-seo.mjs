import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { company, renderMetadata, rootDir, routes, siteUrl } from './metadata.mjs';

const outputDir = path.join(rootDir, 'dist/app/browser');
const home = await readFile(path.join(outputDir, 'index.html'), 'utf8');
const shell = await readFile(path.join(outputDir, 'index.csr.html'), 'utf8');

// Game screens stay client-rendered, with their own head available to sharing crawlers.
for (const route of routes) {
	const target = path.join(outputDir, route.slice(1), 'index.html');
	await mkdir(path.dirname(target), { recursive: true });
	await writeFile(target, renderMetadata(route === '/' ? home : shell, route));
}
await writeFile(path.join(outputDir, '404.html'), renderMetadata(shell, null));
const urls = routes
	.filter((route) => !company.pageSeo[route]?.robots?.includes('noindex'))
	.map((route) => `\t<url><loc>${siteUrl}${route === '/' ? '/' : route}</loc></url>`)
	.join('\n');
await writeFile(
	path.join(outputDir, 'sitemap.xml'),
	`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
);
await writeFile(
	path.join(outputDir, 'robots.txt'),
	`User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`,
);
