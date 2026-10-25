import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateDirective } from '@wawjs/ngx-translate';
import { SessionService } from '../../feature/session/session.service';

/** On phones the lord's places sit here, under the thumb, instead of in the top bar. */
@Component({
	selector: 'app-bottom-bar',
	imports: [RouterLink, RouterLinkActive, TranslateDirective],
	template: `
		@if (user()) {
			<nav
				class="bottom-bar t-bar sticky bottom-0 z-40 grid grid-cols-3 md:hidden"
				[translate]="{ ariaLabel: 'Володіння лорда' }"
			>
				@for (place of places; track place.path) {
					<a
						class="bottom-bar__link theme-focus"
						[routerLink]="place.path"
						routerLinkActive="bottom-bar__link--active"
						ariaCurrentWhenActive="page"
					>
						<span class="material-symbols-outlined text-[24px]" aria-hidden="true">{{
							place.icon
						}}</span>
						<span class="text-xs font-semibold" [translate]="place.label">{{
							place.label
						}}</span>
					</a>
				}
			</nav>
		}
	`,
	styles: `
		.bottom-bar {
			border-top: 1px solid var(--c-border);
			padding-bottom: env(safe-area-inset-bottom);
		}

		.bottom-bar__link {
			display: flex;
			min-height: 3.5rem;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 0.125rem;
			color: var(--c-text-muted);
		}

		.bottom-bar__link--active {
			color: var(--c-primary-text);
		}
	`,
})
export class BottomBarComponent {
	protected readonly user = inject(SessionService).user;
	protected readonly places = [
		{ path: '/world', label: 'Лорди', icon: 'public' },
		{ path: '/village', label: 'Поселення', icon: 'cottage' },
		{ path: '/farm', label: 'Угіддя', icon: 'agriculture' },
	];
}
