# Temnorid: Lords SEO

Temnorid: Lords (Темнорід: Лорди) is a browser strategy game in development, set in Temnorid's dark medieval fantasy world inspired by the 14th century. Players choose Stone or Fire, a region and a lord's name, then explore a settlement, surrounding resource lands and a shared world map. Construction and resource extraction are still in development.

## Sources

- `../temnorid.com/src/data/company/company.json`: world, medieval setting, Stone and Fire.
- `../temnorid.com/src/data/games/games.json`: Lords is in development.
- Local onboarding, village, farm and world components: current playable scope and unfinished mechanics.

## Page coverage

| URL | Intent | Search indexing | Social image |
| --- | --- | --- | --- |
| `/` | Project overview and sign-in | Indexable | `/seo/home.jpg` |
| `/onboarding` | Choose element, region and name | Noindex; requires authentication | `/seo/onboarding.jpg` |
| `/village` | Personal settlement map | Noindex; requires authentication | `/seo/village.jpg` |
| `/farm` | Survey resource lands | Noindex; requires authentication | `/seo/farm.jpg` |
| `/world` | Shared world map | Noindex; requires authentication | `/seo/world.jpg` |

All five covers are distinct AI-generated illustrations, optimized to 1200 × 630 JPEGs. Artwork is conceptual, not a gameplay screenshot. The home cover is also the default project image. Original generated files remain in the Codex generated image directory; production copies live in `src/assets/seo/`.

Generation used the built-in ImageGen tool. The exact final prompts and output mapping are saved in `tools/seo/image-prompts.json`. The five covers are approximately 188–262 KB each.

## Implementation

- `src/data/company/company.json` owns shared and per-route metadata, in Ukrainian to match the default rendered language.
- `src/data/seo/project.json` describes the Organization, parent world website, Lords website, VideoGame and home WebPage. No invented reviews, ratings, release date or offers are included.
- `src/index.html` contains meaningful metadata and project schema before Angular runs.
- `ProjectSeoService` keeps social URL, canonical, image attributes and home-only schema consistent during navigation.
- `tools/seo/generate-static-seo.mjs` writes a prerendered home and separate client shells with page-specific metadata for authenticated routes. It also generates the sitemap, robots.txt and a noindex 404 fallback.
- The deployment workflow preserves those files and validates SEO. It must not overwrite 404.html with the indexable home page.
- Only the public home belongs in the sitemap. Do not disallow private routes in robots.txt: crawlers need to read their noindex tags.
- Language selection uses the same URLs. English metadata and hreflang need dedicated crawlable English URLs before they can be advertised as alternate pages.

## Validation and release

Run `npm run build`; it includes `npm run seo:validate`. Validation checks distinct titles, descriptions and image content, JPEG dimensions and size, social tag consistency, canonical URLs, JSON-LD, indexing policy, client shells and crawler files.

The reviewed production files are in `dist/app/browser`. Deploy through the existing GitHub Pages workflow. After release, verify the five direct URLs, social image responses, robots.txt and sitemap.xml on the production hostname, then request recrawling through the site's search console. Search and social preview caches can take time to refresh.

The initial web-tool request to the production hostname was inaccessible. Local production checks cannot establish the current deployed version or search indexing status.

## Review results (2026-10-22)

- Production build and all five route SEO validations passed.
- Browser checks passed at 390, 1440 and 1728 pixels: hydrated metadata, canonical/social URL agreement, project schema, no horizontal overflow and no page errors.
- Four private routes were checked with JavaScript disabled; each returned its own image metadata and noindex directive.
- Better Design comprehension passed. Rendered spacing inspection completed at all three widths, with no critical or serious findings. Moderate findings concern existing navigation touch targets and spacing values; this SEO repair preserves the established layout.
- Screenshots, browser results, spacing evidence and an image contact sheet are in `output/seo-review/`.
- Changes are local and have not been published.
