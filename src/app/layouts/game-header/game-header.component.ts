import { Component, input } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';

/**
 * Title of an in-game page, for screen readers and the document outline only: the top bar already
 * shows which place is open, so the play area starts right under it.
 */
@Component({
	selector: 'app-game-header',
	imports: [TranslateDirective],
	template: `<h1 class="sr-only" [translate]="title()">{{ title() }}</h1>`,
})
export class GameHeaderComponent {
	readonly title = input.required<string>();
}
