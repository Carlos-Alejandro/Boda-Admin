import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';

import { notify } from '../../../shared/notifications/notify';
import { InvitationArchiveConfirmation } from './InvitationArchiveConfirmation';
import { InvitationStatusBadge } from './InvitationStatusBadge';
import type { Guest, Invitation, InvitationScope } from '../model/invitation.types';
import { getPublicInvitationUrl } from '../model/publicInvitationUrl';

interface InvitationListProps {
	items: Invitation[];
	search: string;
	scope: InvitationScope;
	onInvitationChanged: (invitation: Invitation) => void;
	onReloadRequested: () => void;
}

function hasName(guest: Guest) {
	return guest.name.trim() !== '';
}

function normalizeSearch(value: string) {
	let normalized = '';
	for (const character of value.normalize('NFD')) {
		if (/\p{Mark}/u.test(character)) continue;
		normalized += /\s/u.test(character) ? ' ' : character.toLocaleLowerCase('es-MX');
	}
	return normalized.trim().replace(/\s+/g, ' ');
}

interface HighlightedName {
	name: string;
	matchStart: number;
	matchEnd: number;
}

function matchedGuestNames(invitation: Invitation, search: string): HighlightedName[] {
	const normalizedSearch = normalizeSearch(search);
	if (!normalizedSearch) return [];
	return invitation.guests.filter(hasName).flatMap((guest) => {
		let normalizedName = '';
		const sourceIndexes: number[] = [];
		let previousWasSpace = false;
		for (const [sourceIndex, character] of Array.from(guest.name).entries()) {
			const baseCharacter = character.normalize('NFD').replace(/\p{Mark}/gu, '');
			if (!baseCharacter) continue;
			const isSpace = /\s/u.test(character);
			if (isSpace && (previousWasSpace || normalizedName.length === 0)) continue;
			normalizedName += isSpace ? ' ' : baseCharacter.toLocaleLowerCase('es-MX');
			sourceIndexes.push(sourceIndex);
			previousWasSpace = isSpace;
		}
		normalizedName = normalizedName.trim();
		const matchStart = normalizedName.indexOf(normalizedSearch);
		if (matchStart < 0) return [];
		const matchEnd = matchStart + normalizedSearch.length;
		const sourceStart = sourceIndexes[matchStart];
		const sourceEnd = sourceIndexes[matchEnd - 1];
		if (sourceStart === undefined || sourceEnd === undefined) return [];
		return [{ name: guest.name, matchStart: sourceStart, matchEnd: sourceEnd + 1 }];
	});
}

function MatchedGuestName({ match }: { match: HighlightedName }) {
	return <span>{match.name.slice(0, match.matchStart)}<mark>{match.name.slice(match.matchStart, match.matchEnd)}</mark>{match.name.slice(match.matchEnd)}</span>;
}

function initials(displayName: string) {
	const words = displayName.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return 'I';
	return words.slice(0, 2).map((word) => word[0]?.toLocaleUpperCase('es-MX')).join('');
}

const listDateFormatter = new Intl.DateTimeFormat('es-MX', {
	timeZone: 'America/Cancun',
	day: 'numeric',
	month: 'short',
	year: 'numeric',
});

function updatedAtLabel(value: string | null) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : listDateFormatter.format(date);
}

function CopyInvitationLink({ invitation }: { invitation: Invitation }) {
	const tooltipId = useId();
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(getPublicInvitationUrl(invitation.id));
			notify.success('Enlace copiado', {
				description: `Puedes compartir la invitación de ${invitation.displayName}.`,
			});
		} catch {
			notify.error('No se pudo copiar el enlace', {
				description: 'Inténtalo nuevamente.',
			});
		}
	};

	return (
		<div className="invitation-copy">
			<button
				className="invitation-copy__button"
				type="button"
				onClick={(event) => { event.stopPropagation(); void copy(); }}
				aria-label={`Copiar enlace de ${invitation.displayName}`}
				aria-describedby={tooltipId}
			>
				<svg aria-hidden="true" viewBox="0 0 24 24">
					<path d="M10.6 13.4a4 4 0 0 0 5.7 0l2.1-2.1a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
					<path d="M13.4 10.6a4 4 0 0 0-5.7 0l-2.1 2.1a4 4 0 0 0 5.7 5.7l1.2-1.2" />
				</svg>
			</button>
			<span className="invitation-copy__tooltip" id={tooltipId} role="tooltip">Copiar enlace</span>
		</div>
	);
}

interface InvitationActionsProps {
	invitation: Invitation;
	restoring: boolean;
	onInvitationChanged: (invitation: Invitation) => void;
	onReloadRequested: () => void;
}

function InvitationArchiveAction({ invitation, restoring, onInvitationChanged, onReloadRequested }: InvitationActionsProps) {
	const [confirming, setConfirming] = useState(false);
	const actionButton = useRef<HTMLButtonElement>(null);
	const dialog = useRef<HTMLDivElement>(null);
	const tooltipId = useId();
	const label = restoring ? 'Restaurar invitación' : 'Archivar invitación';

	const closeConfirmation = () => {
		setConfirming(false);
		requestAnimationFrame(() => actionButton.current?.focus());
	};

	useEffect(() => {
		if (!confirming) return;
		const previousOverflow = document.body.style.overflow;
		const appRoot = document.getElementById('root');
		const previousInert = appRoot?.inert;
		document.body.style.overflow = 'hidden';
		if (appRoot) appRoot.inert = true;
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			const cancel = dialog.current?.querySelector<HTMLButtonElement>('[data-archive-cancel]');
			if (!cancel || cancel.disabled) return;
			event.preventDefault();
			cancel.click();
		};
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			if (appRoot) appRoot.inert = previousInert ?? false;
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [confirming]);

	return (
		<>
			<div className="invitation-archive-action">
				<button
					ref={actionButton}
					className={`invitation-icon-action__button${restoring ? ' invitation-icon-action__button--restore' : ' invitation-icon-action__button--archive'}`}
					type="button"
					aria-label={`${label}: ${invitation.displayName}`}
					aria-describedby={tooltipId}
					onClick={() => setConfirming(true)}
				>
					{restoring ? (
						<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8a8 8 0 1 1-1 7" /><path d="M5 3v5h5" /></svg>
					) : (
					<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16v13H4z" /><path d="M3 4h18v3H3zM9 11h6" /></svg>
					)}
				</button>
				<span className="invitation-icon-action__tooltip" id={tooltipId} role="tooltip">{label}</span>
			</div>

			{confirming && createPortal(
				<div className="invitation-confirmation-backdrop">
					<div ref={dialog} className="invitation-confirmation-dialog" role="dialog" aria-modal="true" aria-label={`${restoring ? 'Restaurar' : 'Archivar'} invitación`}>
						<InvitationArchiveConfirmation
							invitation={invitation}
							onCancel={closeConfirmation}
							onSaved={(updated) => { onInvitationChanged(updated); closeConfirmation(); }}
							onUnavailable={() => { closeConfirmation(); onReloadRequested(); }}
							onRefresh={() => { closeConfirmation(); onReloadRequested(); }}
						/>
					</div>
				</div>, document.body
			)}
		</>
	);
}

export function InvitationList({ items, search, scope, onInvitationChanged, onReloadRequested }: InvitationListProps) {
	const navigate = useNavigate();

	return (
		<div className="invitation-table-shell">
			<table className="invitation-table">
				<caption className="visually-hidden">{scope === 'archived' ? 'Listado de invitaciones archivadas' : 'Listado de invitaciones'}</caption>
				<thead>
					<tr>
						<th id="invitation-col-name" scope="col">Familia / Nombre</th>
						<th id="invitation-col-code" scope="col">Código</th>
						<th id="invitation-col-guests" scope="col">Invitados</th>
						<th id="invitation-col-attendance" scope="col">Asistencia</th>
						<th id={scope === 'archived' ? 'invitation-col-archived' : 'invitation-col-status'} scope="col">{scope === 'archived' ? 'Fecha de archivo' : 'Estado'}</th>
						<th id="invitation-col-actions" scope="col">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{items.map((invitation) => {
						const identified = invitation.guests.filter(hasName);
						const matchingGuests = matchedGuestNames(invitation, search);
						const attending = identified.filter((guest) => guest.attending === true).length;
						const declining = identified.filter((guest) => guest.attending === false).length;
						const dateLabel = updatedAtLabel(scope === 'archived' ? invitation.archivedAt : invitation.updatedAt);
						const detailPath = `/invitaciones/${encodeURIComponent(invitation.id)}`;
						return (
							<tr
								key={invitation.id}
								className={`${invitation.isArchived ? 'invitation-table__archived' : ''} invitation-table__clickable-row`}
				onClick={(event) => {
					const target = event.target;
					if (target instanceof Element && target.closest('a, button, input, select, [role="dialog"]')) return;
					navigate(detailPath);
				}}
							>
								<td headers="invitation-col-name" className="invitation-table__identity-cell">
									<div className="invitation-table__identity">
										<span className={`invitation-table__avatar invitation-table__avatar--${invitation.rsvpStatus}`} aria-hidden="true">{initials(invitation.displayName)}</span>
										<span className="invitation-table__identity-copy">
											<Link className="invitation-table__name-link" to={detailPath}>{invitation.displayName}</Link>
											{matchingGuests.length > 0 && (
												<small className="invitation-table__guest-match" aria-label={`Coincidencia: ${matchingGuests.map(({ name }) => name).join(', ')}`}>
													<span aria-hidden="true">{matchingGuests.length === 1 ? 'Coincidencia: ' : 'Coincidencias: '}</span>
													{matchingGuests.slice(0, 2).map((match) => <MatchedGuestName key={`${match.name}-${match.matchStart}`} match={match} />)}
													{matchingGuests.length > 2 && <span aria-hidden="true"> +{matchingGuests.length - 2} más</span>}
												</small>
											)}
										{scope !== 'archived' && dateLabel && <small>Última actualización: {dateLabel}</small>}
										</span>
									</div>
								</td>
								<td headers="invitation-col-code"><span className="invitation-table__mobile-label" aria-hidden="true">Código</span><code>{invitation.id}</code></td>
								<td headers="invitation-col-guests">
									<span className="invitation-table__mobile-label" aria-hidden="true">Invitados</span>
									<div className="invitation-table__count">
										<strong>{identified.length} / {invitation.maxGuests}</strong>
										<small>{identified.length === 1 ? 'identificado' : 'identificados'}</small>
									</div>
								</td>
								<td headers="invitation-col-attendance" className="invitation-table__attendance-cell">
									<span className="invitation-table__mobile-label" aria-hidden="true">Asistencia</span>
									<div className="invitation-table__attendance">
										<span className={attending === 0 ? 'invitation-table__attendance-zero' : 'invitation-table__attendance-positive'}><strong>{attending}</strong> {attending === 1 ? 'asiste' : 'asisten'}</span>
										<span className={declining === 0 ? 'invitation-table__attendance-zero' : undefined}><strong>{declining}</strong> {declining === 1 ? 'no asiste' : 'no asisten'}</span>
									</div>
								</td>
				{scope === 'archived' ? (
					<td headers="invitation-col-archived">
						<span className="invitation-table__mobile-label" aria-hidden="true">Fecha de archivo</span>
						<div className="invitation-table__archive-date"><span>{dateLabel ?? 'Fecha no disponible'}</span><InvitationStatusBadge status="archived" /></div>
					</td>
								) : (
									<td headers="invitation-col-status" className="invitation-table__status-cell"><span className="invitation-table__mobile-label" aria-hidden="true">Estado</span><div className="invitation-table__status"><InvitationStatusBadge status={invitation.rsvpStatus} />{invitation.isArchived && <InvitationStatusBadge status="archived" />}</div></td>
								)}
								<td headers="invitation-col-actions" className="invitation-table__actions-cell">
									<span className="invitation-table__mobile-label" aria-hidden="true">Acciones</span>
									<div className="invitation-row-actions">
										<CopyInvitationLink invitation={invitation} />
										{(scope === 'archived' || invitation.isArchived) ? (
											<InvitationArchiveAction invitation={invitation} restoring onInvitationChanged={onInvitationChanged} onReloadRequested={onReloadRequested} />
										) : (
											<InvitationArchiveAction invitation={invitation} restoring={false} onInvitationChanged={onInvitationChanged} onReloadRequested={onReloadRequested} />
										)}
									</div>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
