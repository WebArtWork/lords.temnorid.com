import { Component } from '@angular/core';
import { TranslateDirective } from '@wawjs/ngx-translate';

@Component({
	selector: 'app-footer',
	imports: [TranslateDirective],
	templateUrl: './footer.component.html',
})
export class FooterComponent {
	protected readonly currentYear = new Date().getFullYear();
}
