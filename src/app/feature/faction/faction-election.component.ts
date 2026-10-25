import {
	Component,
	computed,
	DestroyRef,
	effect,
	inject,
	input,
	signal,
	untracked,
} from '@angular/core';
import { LanguageService, TranslateDirective, TranslateService } from '@wawjs/ngx-translate';
import { formatDuration, nowSignal } from '../building/building.timing';
import { Election, factionRule, ranked } from './election';
import { FactionId } from './faction.data';
import { FactionMember, FactionService } from './faction.service';

/** The faction's president: who leads, or the open vote with its candidates. */
@Component({
	selector: 'app-faction-election',
	imports: [TranslateDirective],
	template: `
		<section aria-labelledby="faction-president" aria-live="polite">
			<h3 id="faction-president" class="t-item" translate>Президент фракції</h3>

			@switch (view().kind) {
				@case ('president') {
					<p class="mt-2 flex items-center gap-2">
						<span
							class="material-symbols-outlined text-[var(--c-primary-text)]"
							aria-hidden="true"
							>workspace_premium</span
						>
						<span class="font-semibold text-[var(--c-text-strong)]">{{
							view().president
						}}</span>
					</p>
					<p class="mt-1 text-sm text-[var(--c-text-muted)]">
						<span translate>Нове голосування можна почати за</span>
						{{ view().termLeft }}
					</p>
				}
				@case ('voting') {
					<p class="mt-2 text-sm text-[var(--c-text-muted)]">
						<span translate>Триває голосування, лишилось</span>
						<span class="ml-1 font-semibold tabular-nums text-[var(--c-text-strong)]">{{
							view().voteLeft
						}}</span>
					</p>
					<ul class="mt-3 grid gap-2">
						@for (candidate of view().candidates; track candidate.uid) {
							<li
								class="candidate"
								[class.candidate--mine]="candidate.uid === view().myVote"
							>
								<span
									class="min-w-0 flex-1 truncate font-semibold text-[var(--c-text-strong)]"
									>{{ candidate.lordName }}</span
								>
								<span class="tabular-nums text-[var(--c-text-muted)]"
									><span translate>Голосів</span>: {{ candidate.votes }}</span
								>
								@if (view().canVote) {
									<button
										class="btn"
										[disabled]="busy() || candidate.uid === view().myVote"
										[attr.aria-pressed]="candidate.uid === view().myVote"
										(click)="vote(candidate.uid)"
										type="button"
									>
										@if (candidate.uid === view().myVote) {
											<span
												class="material-symbols-outlined"
												aria-hidden="true"
												>how_to_vote</span
											>
											<span translate>Ваш голос</span>
										} @else {
											<span translate>Голосувати</span>
										}
									</button>
								}
							</li>
						}
					</ul>
				}
				@case ('vacant') {
					<p class="mt-2 text-sm text-[var(--c-text-muted)]" translate>
						Президента немає. Перша кандидатура відкриває голосування на 24 години.
					</p>
				}
			}

			@if (view().note) {
				<p class="mt-3 text-sm text-[var(--c-text-muted)]">{{ view().note }}</p>
			}
			@if (view().canStand) {
				<button
					class="btn btn--primary mt-4"
					[disabled]="busy()"
					(click)="stand()"
					type="button"
				>
					<span class="material-symbols-outlined" aria-hidden="true">campaign</span>
					<span translate>Подати кандидатуру</span>
				</button>
			}
			@if (failed()) {
				<p class="mt-3 text-sm text-[var(--c-secondary)]" role="alert" translate>
					Не вдалося. Спробуйте ще раз.
				</p>
			}
		</section>
	`,
	styles: `
		.candidate {
			display: flex;
			align-items: center;
			gap: 0.75rem;
			border: 1px solid var(--c-border);
			border-radius: var(--t-radius);
			padding: 0.5rem 0.5rem 0.5rem 0.875rem;
		}

		.candidate--mine {
			border-color: var(--c-primary);
		}
	`,
})
export class FactionElectionComponent {
	private readonly _factions = inject(FactionService);
	private readonly _translateService = inject(TranslateService);
	private readonly _languageService = inject(LanguageService);
	private readonly _now = nowSignal();

	readonly faction = input.required<FactionId>();
	readonly uid = input.required<string>();
	readonly lordName = input.required<string>();

	private readonly _election = signal<Election | null>(null);
	private readonly _members = signal<FactionMember[]>([]);
	protected readonly busy = signal(false);
	protected readonly failed = signal(false);

	protected readonly view = computed(() => {
		this._languageService.language();
		const t = (text: string) => this._translateService.translate(text)();
		const now = this._now();
		const members = this._members();
		const me = members.find((member) => member.uid === this.uid());
		const rule = factionRule(this._election(), new Set(members.map((m) => m.uid)), now);
		const election = rule.election;
		// Only lords who were members when the vote opened take part, as firestore.rules checks.
		const eligible =
			!!me &&
			(!election ||
				rule.kind !== 'voting' ||
				(me.joinedAt > 0 && me.joinedAt < election.startedAt));
		const standing = !!election && election.candidates.some((c) => c.uid === this.uid());
		let note = '';

		if (rule.kind === 'voting' && !eligible) {
			note = t('Ви приєдналися після початку голосування, тож голосуєте наступного разу.');
		}

		return {
			kind: rule.kind,
			president: rule.kind === 'president' ? rule.president.lordName : '',
			termLeft:
				rule.kind === 'president' ? formatDuration((rule.termEndsAt - now) / 1000) : '',
			voteLeft:
				rule.kind === 'voting' ? formatDuration((rule.election.endsAt - now) / 1000) : '',
			candidates: rule.kind === 'voting' ? ranked(rule.election.candidates) : [],
			myVote: rule.kind === 'voting' ? rule.election.myVote : null,
			canVote: rule.kind === 'voting' && eligible,
			canStand:
				rule.kind !== 'president' && eligible && !(rule.kind === 'voting' && standing),
			note,
		};
	});

	constructor() {
		const destroyRef = inject(DestroyRef);
		let stop: (() => void)[] = [];

		effect(() => {
			const faction = this.faction();
			const uid = this.uid();

			untracked(() => {
				stop.forEach((fn) => fn());
				stop = [
					this._factions.watchElection(faction, uid, (election) =>
						this._election.set(election),
					),
					this._factions.watchMembers(faction, (members) => this._members.set(members)),
				];
			});
		});
		destroyRef.onDestroy(() => stop.forEach((fn) => fn()));
	}

	protected async stand() {
		const election = this._election();
		const open = election && election.endsAt > Date.now() ? election.id : null;

		await this._act(() =>
			this._factions.stand(this.faction(), this.uid(), this.lordName(), open),
		);
	}

	protected async vote(candidate: string) {
		const election = this._election();

		if (election) {
			await this._act(() => this._factions.vote(election.id, this.uid(), candidate));
		}
	}

	private async _act(action: () => Promise<void>) {
		this.busy.set(true);
		this.failed.set(false);

		try {
			await action();
		} catch (error) {
			console.error(error);
			this.failed.set(true);
		} finally {
			this.busy.set(false);
		}
	}
}
