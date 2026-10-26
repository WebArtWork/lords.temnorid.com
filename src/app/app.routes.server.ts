import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
	{
		// Player pages depend on the signed-in session, which only exists in the browser.
		path: 'onboarding',
		renderMode: RenderMode.Client,
	},
	{
		path: 'village',
		renderMode: RenderMode.Client,
	},
	{
		path: 'farm',
		renderMode: RenderMode.Client,
	},
	{
		path: 'world',
		renderMode: RenderMode.Client,
	},
	{
		path: 'profile',
		renderMode: RenderMode.Client,
	},
	{
		path: 'building/:slot',
		renderMode: RenderMode.Client,
	},
	{
		path: 'plot/:id',
		renderMode: RenderMode.Client,
	},
	{
		path: 'city/:id',
		renderMode: RenderMode.Client,
	},
	{
		path: 'dungeons',
		renderMode: RenderMode.Client,
	},
	{
		path: 'dungeons/:id',
		renderMode: RenderMode.Client,
	},
	{
		path: '**',
		renderMode: RenderMode.Prerender,
	},
];
