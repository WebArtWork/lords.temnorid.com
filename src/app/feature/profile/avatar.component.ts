import { Component, computed, input, signal } from '@angular/core';

/**
 * The player's picture: their Google photo, or a plain disc with their initial (an icon for guests)
 * when there is no photo or it fails to load. Decorative: whatever wraps it carries the accessible name.
 */
@Component({
	selector: 'app-avatar',
	template: `
		@if (photo()) {
			<img
				class="avatar"
				[src]="photo()"
				[attr.width]="size()"
				[attr.height]="size()"
				alt=""
				referrerpolicy="no-referrer"
				(error)="failed.set(true)"
			/>
		} @else {
			<span
				class="avatar avatar--empty"
				[style.width.px]="size()"
				[style.height.px]="size()"
				aria-hidden="true"
			>
				@if (initial()) {
					<span class="avatar__initial" [style.font-size.px]="size() * 0.45">{{
						initial()
					}}</span>
				} @else {
					<span class="material-symbols-outlined" [style.font-size.px]="size() * 0.6"
						>person</span
					>
				}
			</span>
		}
	`,
	styles: `
		:host {
			display: inline-flex;
		}

		.avatar {
			display: block;
			border-radius: 50%;
			object-fit: cover;
		}

		.avatar--empty {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			background: var(--c-bg-tertiary);
			color: var(--c-text-muted);
		}

		.avatar__initial {
			color: var(--c-text-strong);
			font-family: var(--ff-serif);
			font-weight: 700;
			line-height: 1;
		}
	`,
})
export class AvatarComponent {
	readonly photoUrl = input<string | null | undefined>(null);
	readonly name = input<string | null | undefined>(null);
	readonly size = input(40);

	protected readonly failed = signal(false);
	protected readonly initial = computed(() => this.name()?.trim().charAt(0).toUpperCase() ?? '');
	protected readonly photo = computed(() => (this.failed() ? null : (this.photoUrl() ?? null)));
}
