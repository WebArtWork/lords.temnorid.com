import { Component, inject, input } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { GameService } from '../../feature/game/game.service';

/** Title, lord's name and the switch between the lord's places, shared by in-game pages. */
@Component({
	selector: 'app-game-header',
	imports: [RouterLink, RouterLinkActive, TranslateDirective],
	template: `
		<div class="flex flex-wrap items-end justify-between gap-4">
			<div>
				<h1 class="t-display" [translate]="title()">{{ title() }}</h1>
				<p class="mt-2 t-lead"><span translate>Лорд</span> {{ lordName() }}</p>
			</div>
			<button class="btn" (click)="signOut()" type="button">
				<span class="material-symbols-outlined" aria-hidden="true">logout</span>
				<span translate>Вийти</span>
			</button>
		</div>

		<nav class="mt-6 flex flex-wrap gap-2" [translate]="{ ariaLabel: 'Володіння лорда' }">
			@for (link of links; track link.path) {
				<a
					class="btn"
					[routerLink]="link.path"
					routerLinkActive="game-tab--active"
					ariaCurrentWhenActive="page"
				>
					<span class="material-symbols-outlined" aria-hidden="true">{{ link.icon }}</span>
					<span [translate]="link.label">{{ link.label }}</span>
				</a>
			}
		</nav>
	`,
	styles: `
		.game-tab--active {
			border-color: var(--c-primary);
			background: var(--c-bg-tertiary);
		}
	`,
})
export class GameHeaderComponent {
	private readonly _game = inject(GameService);
	private readonly _router = inject(Router);

	readonly title = input.required<string>();
	readonly lordName = input.required<string>();

	protected readonly links = [
		{ path: '/village', label: 'Поселення', icon: 'cottage' },
		{ path: '/farm', label: 'Угіддя', icon: 'agriculture' },
		{ path: '/world', label: 'Світ', icon: 'public' },
	];

	protected async signOut() {
		await this._game.signOut();
		await this._router.navigateByUrl('/');
	}
}
