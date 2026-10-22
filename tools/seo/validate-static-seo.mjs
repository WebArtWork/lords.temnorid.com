import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { company, rootDir, routes, siteUrl } from './metadata.mjs';

const output = path.join(rootDir, 'dist/app/browser');
const images = new Set();
const titles = new Set();
const descriptions = new Set();
for (const route of routes) {
	const html = await readFile(path.join(output, route.slice(1), 'index.html'), 'utf8');
	const head = html.match(/<head>([\s\S]*?)<\/head>/i)?.[1];
	assert(head, `${route}: missing head`);
	assert(
		!/ngx\.itkamianets|example\.com|rule your domain/.test(head),
		`${route}: template metadata`,
	);
	assert.equal((head.match(/<title>/g) ?? []).length, 1);
	const title = head.match(/<title>(.*?)<\/title>/)?.[1];
	assert(title && !titles.has(title), `${route}: missing or duplicate title`);
	titles.add(title);
	function meta(key) {
		const tags = [...head.matchAll(/<meta\b[^>]*>/g)]
			.map(([tag]) => {
				const attrs = Object.fromEntries(
					[...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1], m[2]]),
				);
				return attrs;
			})
			.filter((attrs) => attrs.name === key || attrs.property === key);
		assert.equal(tags.length, 1, `${route}: expected one ${key}`);
		assert(tags[0].content, `${route}: empty ${key}`);
		return tags[0].content;
	}
	const description = meta('description');
	assert(!descriptions.has(description), `${route}: duplicate description`);
	descriptions.add(description);
	assert.equal(meta('og:title'), title);
	assert.equal(meta('twitter:title'), title);
	assert.equal(meta('og:description'), description);
	assert.equal(meta('twitter:description'), description);
	assert.equal(meta('og:locale'), 'uk_UA');
	assert.equal(meta('twitter:card'), 'summary_large_image');
	assert.equal(meta('og:url'), `${siteUrl}${route === '/' ? '/' : route}`);
	assert.equal((head.match(/rel="canonical"/g) ?? []).length, 1);
	assert(head.includes(`rel="canonical" href="${siteUrl}${route === '/' ? '/' : route}"`));
	assert.equal(meta('robots').includes('noindex'), route !== '/');
	const imageUrl = meta('og:image');
	assert.equal(imageUrl, meta('twitter:image'));
	assert.equal(imageUrl, meta('twitter:image:src'));
	assert(meta('og:image:alt') && meta('twitter:image:alt'));
	assert.equal(meta('og:image:width'), '1200');
	assert.equal(meta('og:image:height'), '630');
	const image = await readFile(path.join(output, new URL(imageUrl).pathname));
	assert.equal(image.readUInt16BE(0), 0xffd8, `${route}: expected JPEG`);
	let dimensions;
	for (let offset = 2; offset < image.length; ) {
		assert.equal(image[offset], 0xff);
		const marker = image[offset + 1];
		if ([0xc0, 0xc1, 0xc2].includes(marker)) {
			dimensions = [image.readUInt16BE(offset + 7), image.readUInt16BE(offset + 5)];
			break;
		}
		offset += 2 + image.readUInt16BE(offset + 2);
	}
	assert.deepEqual(dimensions, [1200, 630], `${route}: incorrect image dimensions`);
	assert(image.length < 500_000, `${route}: social image too large`);
	const hash = createHash('sha256').update(image).digest('hex');
	assert(!images.has(hash), `${route}: duplicate artwork`);
	images.add(hash);
	if (route === '/') {
		assert(
			html.includes('Браузерна фентезі-стратегія'),
			'Missing crawlable project introduction',
		);
		const schema = JSON.parse(
			head.match(
				/<script type="application\/ld\+json" id="project-schema">(.*?)<\/script>/s,
			)[1],
		);
		for (const type of ['WebSite', 'VideoGame', 'Organization', 'WebPage']) {
			assert(
				schema['@graph'].some((item) => item['@type'] === type),
				`Missing ${type} schema`,
			);
		}
	} else {
		assert(!head.includes('id="project-schema"'), `${route}: home schema leaked`);
		assert(!html.includes('ngh='), `${route}: game page must use the client shell`);
	}
}
const sitemap = await readFile(path.join(output, 'sitemap.xml'), 'utf8');
assert.deepEqual(
	[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]),
	[`${siteUrl}/`],
);
assert(
	(await readFile(path.join(output, 'robots.txt'), 'utf8')).includes(
		`Sitemap: ${siteUrl}/sitemap.xml`,
	),
);
const fallback = await readFile(path.join(output, '404.html'), 'utf8');
assert(fallback.includes('content="noindex, nofollow"'));
const seed = await readFile(path.join(rootDir, 'src/index.html'), 'utf8');
assert(seed.includes(company.defaultSeo.title) && seed.includes(company.defaultSeo.description));
console.log(
	`SEO verified: ${routes.length} unique pages and images, metadata, canonical URLs, schema, sitemap, private shells and noindex fallback.`,
);
