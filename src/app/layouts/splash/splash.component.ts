import { Component } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';

/**
 * The logo with a turning ring, over everything while the app finds out who is here. Always on the
 * logo's own near-black, so it reads the same in light and dark mode.
 */
@Component({
	selector: 'app-splash',
	imports: [TranslateDirective],
	template: `
		<div class="splash" role="status" aria-live="polite">
			<div class="splash__mark">
				<span class="splash__ring" aria-hidden="true"></span>
				<img class="splash__logo" src="logo-splash.webp" width="96" height="96" alt="" />
			</div>
			<span class="sr-only" translate>Завантаження…</span>
		</div>
	`,
	styles: `
		.splash {
			position: fixed;
			z-index: 1000;
			inset: 0;
			display: grid;
			place-items: center;
			background: #121111;
		}

		.splash__mark {
			position: relative;
			display: grid;
			width: 9rem;
			height: 9rem;
			place-items: center;
		}

		.splash__logo {
			width: 6rem;
			height: 6rem;
			border-radius: 50%;
		}

		/* A thin gold arc that turns around the logo. */
		.splash__ring {
			position: absolute;
			inset: 0;
			border: 3px solid rgb(228 167 74 / 0.18);
			border-top-color: #e4a74a;
			border-radius: 50%;
			animation: splash-turn 1s linear infinite;
		}

		@keyframes splash-turn {
			to {
				transform: rotate(1turn);
			}
		}

		@media (prefers-reduced-motion: reduce) {
			.splash__ring {
				animation: splash-glow 1.6s ease-in-out infinite alternate;
			}

			@keyframes splash-glow {
				from {
					opacity: 0.4;
				}
			}
		}
	`,
})
export class SplashComponent {}
