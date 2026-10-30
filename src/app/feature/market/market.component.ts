import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { formatDuration, nowSignal } from '../building/building.timing';
import { GameService } from '../game/game.service';
import { RESOURCE_BY_ID, RESOURCES } from '../resource/resource.data';
import { ResourceId } from '../resource/resource.interface';
import {
	marketLevel,
	nearestCity,
	npcRate,
	npcReceive,
	Offer,
	offerLimit,
	OFFER_MAX_AMOUNT,
	paymentArrivesAt,
	TradeError,
	travelSeconds,
} from './market';
import { MarketService } from './market.service';

type Tab = 'npc' | 'board' | 'mine';

/**
 * The marketplace's work, shown on its building page: swap with the NPC merchants at once, buy
 * from the board other lords post to, or post and manage the lord's own offers.
 */
@Component({
	selector: 'app-market',
	imports: [NgTemplateOutlet, TranslateDirective],
	template: `
		<ng-template #res let-id let-amount="amount">
			<span class="inline-flex items-center gap-1" [title]="name(id)">
				<span
					class="material-symbols-outlined text-[20px]"
					[style.color]="color(id)"
					aria-hidden="true"
					>{{ icon(id) }}</span
				>
				<span class="font-semibold tabular-nums">{{ amount }}</span>
				<span class="sr-only">{{ name(id) }}</span>
			</span>
		</ng-template>

		<section class="t-card max-w-[36rem]" aria-labelledby="market-title">
			<h2 id="market-title" class="t-item" translate>Торгівля</h2>

			<div class="mt-4 flex flex-wrap gap-2" role="group" [attr.aria-label]="t('Вид торгівлі')">
				@for (item of tabs; track item.id) {
					<button
						class="btn"
						[class.market-tab--active]="tab() === item.id"
						[attr.aria-pressed]="tab() === item.id"
						(click)="open(item.id)"
						type="button"
					>
						<span class="material-symbols-outlined" aria-hidden="true">{{
							item.icon
						}}</span>
						<span [translate]="item.label">{{ item.label }}</span>
					</button>
				}
			</div>

			@if (shipments().length) {
				<div class="market-road mt-5">
					<h3 class="t-item" translate>У дорозі</h3>
					<ul class="mt-2 grid gap-2">
						@for (shipment of shipments(); track shipment.id) {
							<li class="flex flex-wrap items-center gap-x-3 gap-y-1">
								<ng-container
									*ngTemplateOutlet="res; context: { $implicit: shipment.resource, amount: shipment.amount }"
								/>
								<span class="text-sm text-[var(--c-text-muted)]">
									<span translate>Від</span> {{ shipment.from }}
								</span>
								<span class="text-sm text-[var(--c-text-muted)]">
									<span translate>Прибуде за</span>
									<span class="font-semibold tabular-nums text-[var(--c-text-strong)]">{{
										shipment.left
									}}</span>
								</span>
							</li>
						}
					</ul>
				</div>
			}

			<div class="mt-5" aria-live="polite">
				@switch (tab()) {
					@case ('npc') {
						<form (submit)="exchange($event)" novalidate>
							<p class="text-[var(--c-text-muted)]" translate>
								Торговці беруть собі частку. Товар їде до найближчого міста, тому обмін займає час.
							</p>
							<p class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
								<span class="inline-flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[20px]" aria-hidden="true"
										>castle</span
									>
									<span class="text-[var(--c-text-muted)]" translate>Найближче місто</span>
									<span class="font-semibold">{{ cityName() }}</span>
								</span>
								<span class="inline-flex items-center gap-1.5">
									<span class="material-symbols-outlined text-[20px]" aria-hidden="true"
										>local_shipping</span
									>
									<span class="text-[var(--c-text-muted)]" translate>Час у дорозі</span>
									<span class="font-semibold tabular-nums">{{ npcTime() }}</span>
								</span>
							</p>
							<div class="mt-4 grid gap-4 sm:grid-cols-2">
								<div>
									<label class="market-label" for="npc-give" translate>Віддаю</label>
									<select
										id="npc-give"
										class="market-field"
										(change)="setGive(pick($event))"
									>
										@for (r of resources; track r.id) {
											<option [value]="r.id" [selected]="r.id === give()">
												{{ names()[r.id] }}
											</option>
										}
									</select>
								</div>
								<div>
									<label class="market-label" for="npc-want" translate>Отримую</label>
									<select
										id="npc-want"
										class="market-field"
										(change)="setWant(pick($event))"
									>
										@for (r of resources; track r.id) {
											<option [value]="r.id" [selected]="r.id === want()">
												{{ names()[r.id] }}
											</option>
										}
									</select>
								</div>
							</div>
							<label class="market-label mt-4" for="npc-amount" translate>Кількість</label>
							<input
								id="npc-amount"
								class="market-field"
								type="number"
								inputmode="numeric"
								min="1"
								step="1"
								autocomplete="off"
								[value]="amount()"
								(input)="amount.set(value($event))"
							/>
							<p class="mt-2 text-sm text-[var(--c-text-muted)]">
								<span translate>У сховищі</span>
								{{ have() }} ·
								<span translate>Ставка</span>
								{{ rate() }}%
							</p>
							<p class="mt-3 flex flex-wrap items-center gap-2">
								<span translate>Ви отримаєте</span>
								<ng-container
									*ngTemplateOutlet="res; context: { $implicit: want(), amount: receive() }"
								/>
							</p>
							<button class="btn btn--primary mt-4" [disabled]="busy()" type="submit">
								<span class="material-symbols-outlined" aria-hidden="true"
									>currency_exchange</span
								>
								<span translate>Обміняти</span>
							</button>
						</form>
					}
					@case ('board') {
						<p class="text-[var(--c-text-muted)]" translate>
							Пропозиції інших лордів. Ставку кожен призначає сам.
						</p>
						@if (board().length) {
							<ul class="mt-4 grid gap-3">
								@for (offer of board(); track offer.id) {
									<li class="market-row">
										<div class="min-w-0 flex-1">
											<p class="truncate font-semibold text-[var(--c-text-strong)]">
												{{ offer.lordName }}
											</p>
											<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
												<ng-container
													*ngTemplateOutlet="res; context: { $implicit: offer.give, amount: offer.giveAmount }"
												/>
												<span class="text-[var(--c-text-muted)]" aria-hidden="true"
													>←</span
												>
												<span class="sr-only" translate>за</span>
												<ng-container
													*ngTemplateOutlet="res; context: { $implicit: offer.want, amount: offer.wantAmount }"
												/>
											</p>
											<p class="mt-1 flex items-center gap-1.5 text-sm text-[var(--c-text-muted)]">
												<span class="material-symbols-outlined text-[18px]" aria-hidden="true"
													>local_shipping</span
												>
												<span translate>Дорога до вас</span>
												<span class="font-semibold tabular-nums text-[var(--c-text-strong)]">{{
													road(offer)
												}}</span>
											</p>
										</div>
										<button
											class="btn btn--primary"
											[disabled]="busy()"
											(click)="buy(offer)"
											type="button"
										>
											<span translate>Купити</span>
										</button>
									</li>
								}
							</ul>
						} @else {
							<p class="mt-4" translate>Поки що ніхто нічого не пропонує.</p>
						}
					}
					@case ('mine') {
						<form (submit)="post($event)" novalidate>
							<p class="text-[var(--c-text-muted)]">
								<span translate>Товар піде зі сховища, поки пропозицію не куплять або не скасують.</span>
								<span class="font-semibold tabular-nums">
									{{ mine().length }} / {{ limit() }}</span
								>
							</p>
							<div class="mt-4 grid gap-4 sm:grid-cols-2">
								<div>
									<label class="market-label" for="offer-give" translate>Віддаю</label>
									<select
										id="offer-give"
										class="market-field"
										(change)="setGive(pick($event))"
									>
										@for (r of resources; track r.id) {
											<option [value]="r.id" [selected]="r.id === give()">
												{{ names()[r.id] }}
											</option>
										}
									</select>
									<input
										class="market-field mt-2"
										type="number"
										inputmode="numeric"
										min="1"
										step="1"
										autocomplete="off"
										[attr.aria-label]="t('Кількість, яку віддаю')"
										[value]="amount()"
										(input)="amount.set(value($event))"
									/>
								</div>
								<div>
									<label class="market-label" for="offer-want" translate>Хочу взамін</label>
									<select
										id="offer-want"
										class="market-field"
										(change)="setWant(pick($event))"
									>
										@for (r of resources; track r.id) {
											<option [value]="r.id" [selected]="r.id === want()">
												{{ names()[r.id] }}
											</option>
										}
									</select>
									<input
										class="market-field mt-2"
										type="number"
										inputmode="numeric"
										min="1"
										step="1"
										autocomplete="off"
										[attr.aria-label]="t('Кількість, яку хочу')"
										[value]="wantAmount()"
										(input)="wantAmount.set(value($event))"
									/>
								</div>
							</div>
							<p class="mt-2 text-sm text-[var(--c-text-muted)]">
								<span translate>У сховищі</span> {{ have() }}
							</p>
							<button class="btn btn--primary mt-4" [disabled]="busy()" type="submit">
								<span class="material-symbols-outlined" aria-hidden="true"
									>add_business</span
								>
								<span translate>Розмістити</span>
							</button>
						</form>

						@if (mine().length) {
							<h3 class="t-item mt-6" translate>Мої пропозиції</h3>
							<ul class="mt-3 grid gap-3">
								@for (offer of mine(); track offer.id) {
									<li class="market-row">
										<div class="min-w-0 flex-1">
											<p class="flex flex-wrap items-center gap-x-2 gap-y-1">
												<ng-container
													*ngTemplateOutlet="res; context: { $implicit: offer.give, amount: offer.giveAmount }"
												/>
												<span class="text-[var(--c-text-muted)]" aria-hidden="true"
													>←</span
												>
												<span class="sr-only" translate>за</span>
												<ng-container
													*ngTemplateOutlet="res; context: { $implicit: offer.want, amount: offer.wantAmount }"
												/>
											</p>
											@if (offer.status === 'filled' && paymentLeft(offer) > 0) {
												<p class="mt-1 text-sm text-[var(--c-text-muted)]">
													<span translate>Куплено. Оплата в дорозі.</span>
													<span translate>Оплата прибуде за</span>
													<span class="font-semibold tabular-nums text-[var(--c-text-strong)]">{{
														paymentIn(offer)
													}}</span>
												</p>
											} @else if (offer.status === 'filled') {
												<p class="mt-1 text-sm text-[var(--c-text-muted)]" translate>
													Куплено. Заберіть оплату.
												</p>
											} @else {
												<p class="mt-1 text-sm text-[var(--c-text-muted)]" translate>
													Чекає на покупця
												</p>
											}
										</div>
										@if (offer.status === 'filled') {
											<button
												class="btn btn--primary"
												[disabled]="busy() || paymentLeft(offer) > 0"
												(click)="collect(offer)"
												type="button"
											>
												<span translate>Забрати</span>
											</button>
										} @else {
											<button
												class="btn btn--danger"
												[disabled]="busy()"
												(click)="cancel(offer)"
												type="button"
											>
												<span translate>Скасувати</span>
											</button>
										}
									</li>
								}
							</ul>
						}
					}
				}

				@if (message(); as message) {
					<p
						class="mt-3 text-sm"
						[class.text-[var(--c-secondary)]]="message.error"
						[attr.role]="message.error ? 'alert' : 'status'"
					>
						{{ message.text }}
					</p>
				}
			</div>
		</section>
	`,
	styles: `
		.market-tab--active {
			border-color: var(--c-primary);
			background: var(--c-bg-tertiary);
		}

		.market-road {
			border: 1px dashed var(--c-border);
			border-radius: var(--t-radius-btn);
			padding: 0.75rem 1rem;
		}

		.market-label {
			display: block;
			margin-bottom: 0.25rem;
			color: var(--c-text-muted);
			font-size: 0.875rem;
		}

		.market-field {
			width: 100%;
			min-height: var(--t-btn-height);
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius-btn);
			background-color: var(--c-bg-secondary);
			padding: 0 0.75rem;
			color: var(--c-text-strong);
		}

		.market-field:focus-visible {
			outline: none;
			border-color: var(--c-primary);
			box-shadow: var(--focus-ring);
		}

		.market-row {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius-btn);
			background: var(--c-bg-secondary);
			padding: 0.75rem 1rem;
		}
	`,
})
export class MarketComponent {
	private readonly _game = inject(GameService);
	private readonly _market = inject(MarketService);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	protected readonly resources = RESOURCES;
	protected readonly tabs: { id: Tab; label: string; icon: string }[] = [
		{ id: 'npc', label: 'Торговці', icon: 'storefront' },
		{ id: 'board', label: 'Дошка', icon: 'groups' },
		{ id: 'mine', label: 'Мої пропозиції', icon: 'sell' },
	];

	protected readonly tab = signal<Tab>('npc');
	protected readonly give = signal<ResourceId>('wood');
	protected readonly want = signal<ResourceId>('stone');
	protected readonly amount = signal('');
	protected readonly wantAmount = signal('');
	protected readonly busy = signal(false);
	protected readonly message = signal<{ text: string; error: boolean } | null>(null);
	private readonly _open = signal<Offer[]>([]);
	protected readonly mine = signal<Offer[]>([]);

	protected readonly names = computed(() => {
		this._languageService.language();

		return Object.fromEntries(
			RESOURCES.map((r) => [r.id, this._translateService.translate(r.name)()]),
		) as Record<ResourceId, string>;
	});
	/** Other lords' open offers, newest first. */
	protected readonly board = computed(() =>
		this._open()
			.filter((offer) => offer.uid !== this._game.game()?.uid)
			.sort((a, b) => b.createdAt - a.createdAt),
	);
	private readonly _level = computed(() =>
		marketLevel(this._game.game()?.village.buildings ?? {}, this._now()),
	);
	private readonly _at = computed(() => {
		const game = this._game.game();

		return game ? this._game.villageAt(game) : { x: 0, y: 0 };
	});
	private readonly _city = computed(() => nearestCity(this._at()));
	protected readonly cityName = computed(() => {
		this._languageService.language();

		return this._translateService.translate(this._city().name)();
	});
	protected readonly npcTime = computed(() =>
		formatDuration(travelSeconds(this._at(), this._city())),
	);
	/** Goods on their way to the stores, soonest first. */
	protected readonly shipments = computed(() => {
		this._languageService.language();
		const now = this._now();

		return [...(this._game.game()?.shipments ?? [])]
			.sort((a, b) => a.arriveAt - b.arriveAt)
			.map((shipment) => ({
				id: shipment.id,
				resource: shipment.resource,
				amount: shipment.amount,
				from:
					shipment.kind === 'npc'
						? this._translateService.translate(shipment.source)()
						: shipment.source,
				left: formatDuration((shipment.arriveAt - now) / 1000),
			}));
	});
	protected readonly limit = computed(() => offerLimit(this._level()));
	protected readonly rate = computed(() => Math.round(npcRate(this._level()) * 100));
	protected readonly receive = computed(() => npcReceive(this._number(this.amount()), this._level()));
	protected readonly have = computed(() => {
		const game = this._game.game();

		return game ? Math.floor(this._game.stockNow(game, this._now())[this.give()]) : 0;
	});

	constructor() {
		const uid = this._game.game()!.uid;
		const failed = (error: unknown) => console.error(error);
		const stops = [
			this._market.watchOpen((offers) => this._open.set(offers), failed),
			this._market.watchMine(
				uid,
				(offers) => this.mine.set([...offers].sort((a, b) => b.createdAt - a.createdAt)),
				failed,
			),
		];

		inject(DestroyRef).onDestroy(() => stops.forEach((stop) => stop()));
	}

	protected t(text: string): string {
		this._languageService.language();

		return this._translateService.translate(text)();
	}

	protected name(id: ResourceId) {
		return this.names()[id];
	}

	protected icon(id: ResourceId) {
		return RESOURCE_BY_ID[id].icon;
	}

	protected color(id: ResourceId) {
		return RESOURCE_BY_ID[id].color;
	}

	protected pick(event: Event) {
		return (event.target as HTMLSelectElement).value as ResourceId;
	}

	protected value(event: Event) {
		return (event.target as HTMLInputElement).value;
	}

	/** Picks what to give, and moves the other side off it, since a trade needs two goods. */
protected setGive(id: ResourceId) {
	this.give.set(id);

	if (this.want() === id) {
		this.want.set(this._other(id));
	}
}

protected setWant(id: ResourceId) {
	this.want.set(id);

	if (this.give() === id) {
		this.give.set(this._other(id));
	}
}

/** The road from an offer's village to this lord's. */
protected road(offer: Offer): string {
	return formatDuration(travelSeconds(offer.at ?? { x: 0, y: 0 }, this._at()));
}

/** Milliseconds until a bought offer's payment reaches the poster. */
protected paymentLeft(offer: Offer): number {
	return paymentArrivesAt(offer) - this._now();
}

protected paymentIn(offer: Offer): string {
	return formatDuration(this.paymentLeft(offer) / 1000);
}

private _other(id: ResourceId): ResourceId {
	return RESOURCES.find((r) => r.id !== id)!.id;
}

protected open(tab: Tab) {
		this.tab.set(tab);
		this.message.set(null);
	}

	protected exchange(event: Event) {
		event.preventDefault();

		return this._run(
			() => this._game.exchange(this.give(), this._number(this.amount()), this.want()),
			'Обмін розпочато. Товар у дорозі.',
			() => this.amount.set(''),
		);
	}

	protected post(event: Event) {
		event.preventDefault();

		if (this.mine().length >= this.limit()) {
			this._say('Усі місця для пропозицій зайняті. Підніміть торжище.', true);

			return;
		}

		const giveAmount = this._number(this.amount());
		const wantAmount = this._number(this.wantAmount());

		if (giveAmount > OFFER_MAX_AMOUNT || wantAmount > OFFER_MAX_AMOUNT) {
			this._say('Пропозиція недійсна.', true);

			return;
		}

		return this._run(
			() => this._game.postOffer(this.give(), giveAmount, this.want(), wantAmount),
			'Пропозицію розміщено.',
			() => {
				this.amount.set('');
				this.wantAmount.set('');
			},
		);
	}

	protected buy(offer: Offer) {
		return this._run(() => this._game.buyOffer(offer), 'Куплено. Товар у дорозі.');
	}

	protected cancel(offer: Offer) {
		return this._run(() => this._game.cancelOffer(offer), 'Пропозицію скасовано.');
	}

	protected collect(offer: Offer) {
		return this._run(() => this._game.collectOffer(offer), 'Оплату отримано.');
	}

	/** Whole number from a field, 0 when it holds anything else; the checks name what is wrong. */
	private _number(text: string): number {
		const n = Number(text.trim());

		return Number.isInteger(n) && n > 0 ? n : 0;
	}

	private async _run(action: () => Promise<void>, done: string, after?: () => void) {
		this.busy.set(true);
		this.message.set(null);

		try {
			await action();
			after?.();
			this._say(done, false);
		} catch (error) {
			console.error(error);
			this._say(
				error instanceof TradeError ? error.message : 'Не вдалося виконати. Спробуйте ще раз.',
				true,
			);
		} finally {
			this.busy.set(false);
		}
	}

	private _say(text: string, error: boolean) {
		this.message.set({ text: this.t(text), error });
	}
}
