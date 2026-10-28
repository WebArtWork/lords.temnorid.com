import { Component, input } from '@angular/core';

/**
 * The lord's picture. A static placeholder for now: the player's real Google photo and name are
 * never shown in the game. Decorative: whatever wraps it carries the accessible name.
 */
@Component({
	selector: 'app-avatar',
	template: `
		<span
			class="avatar"
			[style.width.px]="size()"
			[style.height.px]="size()"
			aria-hidden="true"
		>
			<span class="material-symbols-outlined" [style.font-size.px]="size() * 0.6">person</span>
		</span>
	`,
	styles: `
		:host {
			display: inline-flex;
		}

		.avatar {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			border-radius: 50%;
			background: var(--c-bg-tertiary);
			color: var(--c-text-muted);
		}
	`,
})
export class AvatarComponent {
	readonly size = input(40);
}
