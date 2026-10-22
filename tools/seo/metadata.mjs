import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const company = JSON.parse(
	await readFile(path.join(rootDir, 'src/data/company/company.json'), 'utf8'),
);
const schema = JSON.parse(await readFile(path.join(rootDir, 'src/data/seo/project.json'), 'utf8'));
export const siteUrl = company.siteUrl.replace(/\/+$/, '');
export const routes = Object.keys(company.pageSeo);

function escape(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

export function renderMetadata(html, route) {
	const page = company.pageSeo[route] ?? {};
	const title = page.title
		? `${page.title}${page.titleSuffix ?? ` | ${company.name}`}`
		: company.defaultSeo.title;
	const description = page.description ?? company.defaultSeo.description;
	const image = new URL(page.image ?? company.defaultSeo.image, `${siteUrl}/`).href;
	const canonical = `${siteUrl}${!route || route === '/' ? '/' : route}`;
	const robots =
		route === null ? 'noindex, nofollow' : (page.robots ?? company.defaultSeo.robots);
	const tags = [
		['name', 'description', description],
		['name', 'author', company.defaultSeo.author],
		['name', 'robots', robots],
		['itemprop', 'name', title],
		['itemprop', 'description', description],
		['itemprop', 'image', image],
		['property', 'og:type', 'website'],
		['property', 'og:site_name', company.name],
		['property', 'og:locale', company.locale],
		['property', 'og:url', canonical],
		['property', 'og:title', title],
		['property', 'og:description', description],
		['property', 'og:image', image],
		['property', 'og:image:width', '1200'],
		['property', 'og:image:height', '630'],
		['property', 'og:image:type', 'image/jpeg'],
		['property', 'og:image:alt', page.title ?? title],
		['name', 'twitter:card', 'summary_large_image'],
		['name', 'twitter:title', title],
		['name', 'twitter:description', description],
		['name', 'twitter:image', image],
		['name', 'twitter:image:src', image],
		['name', 'twitter:image:alt', page.title ?? title],
	];
	return html.replace(/<head>([\s\S]*?)<\/head>/i, (_, head) => {
		head = head
			.replace(/<title>[\s\S]*?<\/title>/gi, '')
			.replace(
				/<meta\b[^>]*(?:name=["'](?:description|author|robots|twitter:[^"']+)["']|property=["']og:[^"']+["']|itemprop=["'](?:name|description|image)["'])[^>]*>/gi,
				'',
			)
			.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/gi, '')
			.replace(/<script\b[^>]*id=["']project-schema["'][^>]*>[\s\S]*?<\/script>/gi, '');
		const metadata = tags
			.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escape(value)}" />`)
			.join('\n');
		const jsonLd =
			route === '/'
				? `<script type="application/ld+json" id="project-schema">${JSON.stringify(schema).replaceAll('<', '\\u003c')}</script>`
				: '';
		return `<head>${head}\n<title>${escape(title)}</title>\n${metadata}\n<link rel="canonical" href="${canonical}" />\n${jsonLd}\n</head>`;
	});
}
