import { type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';

import { useViewportPopover } from '../../../shared/hooks/useViewportPopover';
import { notify } from '../../../shared/notifications/notify';
import { InvitationArchiveConfirmation } from './InvitationArchiveConfirmation';
import { InvitationStatusBadge } from './InvitationStatusBadge';
import type { Guest, Invitation } from '../model/invitation.types';
import { getPublicInvitationUrl } from '../model/publicInvitationUrl';

interface InvitationListProps {
	items: Invitation[];
	search: string;
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
				onClick={() => void copy()}
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
	open: boolean;
	onToggle: () => void;
	onClose: () => void;
	onInvitationChanged: (invitation: Invitation) => void;
	onReloadRequested: () => void;
}

function InvitationActions({ invitation, open, onToggle, onClose, onInvitationChanged, onReloadRequested }: InvitationActionsProps) {
	const [confirmingArchive, setConfirmingArchive] = useState(false);
	const actionRoot = useRef<HTMLDivElement>(null);
	const trigger = useRef<HTMLButtonElement>(null);
	const menu = useRef<HTMLDivElement>(null);
	const dialog = useRef<HTMLDivElement>(null);
	const menuId = useId();
	const menuSpace = useViewportPopover(open, actionRoot, menu);

	useEffect(() => {
		if (!open) return;
		const onPointerDown = (event: MouseEvent) => {
			if (!actionRoot.current?.contains(event.target as Node)) onClose();
		};
		const onEscape = (event: globalThis.KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			onClose();
			trigger.current?.focus();
		};
		document.addEventListener('mousedown', onPointerDown);
		document.addEventListener('keydown', onEscape);
		return () => {
			document.removeEventListener('mousedown', onPointerDown);
			document.removeEventListener('keydown', onEscape);
		};
	}, [onClose, open]);

	const menuItems = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
	const focusMenuItem = (index: number) => requestAnimationFrame(() => menuItems()[index]?.focus());

	const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		if (!open) onToggle();
		requestAnimationFrame(() => {
			const items = menuItems();
			items[event.key === 'ArrowUp' ? items.length - 1 : 0]?.focus();
		});
	};

	const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Home' && event.key !== 'End') return;
		event.preventDefault();
		const items = menuItems();
		const current = items.indexOf(document.activeElement as HTMLElement);
		if (event.key === 'Home') return focusMenuItem(0);
		if (event.key === 'End') return focusMenuItem(items.length - 1);
		const next = event.key === 'ArrowDown'
			? (current + 1) % items.length
			: (current - 1 + items.length) % items.length;
		focusMenuItem(next);
	};

	const closeConfirmation = () => {
		setConfirmingArchive(false);
		requestAnimationFrame(() => trigger.current?.focus());
	};

	useEffect(() => {
		if (!confirmingArchive) return;
		const previousOverflow = document.body.style.overflow;
		const appRoot = document.getElementById('root');
		const previousInert = appRoot?.inert;
		document.body.style.overflow = 'hidden';
		if (appRoot) appRoot.inert = true;
		const onKeyDown = (event: globalThis.KeyboardEvent) => {
			if (event.key === 'Escape') {
				const cancel = dialog.current?.querySelector<HTMLButtonElement>('[data-archive-cancel]');
				if (!cancel || cancel.disabled) return;
				event.preventDefault();
				cancel.click();
			} else if (event.key === 'Tab') {
				const buttons = Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') ?? []);
				const first = buttons[0];
				const last = buttons.at(-1);
				if (!first || !last) return;
				if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current?.querySelector('h3'))) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			}
		};
		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			if (appRoot) appRoot.inert = previousInert ?? false;
			document.removeEventListener('keydown', onKeyDown);
		};
	}, [confirmingArchive]);

	return (
		<>
			<div className="invitation-actions" ref={actionRoot}>
				<Link className="invitation-actions__detail" to={`/invitaciones/${encodeURIComponent(invitation.id)}`}>
					Ver detalle <span aria-hidden="true">›</span>
				</Link>
				<button
					ref={trigger}
					className="invitation-actions__trigger"
					type="button"
					aria-label={`Más acciones para ${invitation.displayName}`}
					aria-haspopup="menu"
					aria-expanded={open}
					aria-controls={menuId}
					onClick={onToggle}
					onKeyDown={onTriggerKeyDown}
				>
					<span aria-hidden="true">⋮</span>
				</button>
				{open && (
					<div ref={menu} id={menuId} className={`invitation-actions__menu${menuSpace.above ? ' invitation-actions__menu--above' : ''}`} style={{ maxHeight: menuSpace.maxHeight }} role="menu" onKeyDown={onMenuKeyDown}>
						<Link role="menuitem" tabIndex={0} to={`/invitaciones/${encodeURIComponent(invitation.id)}`} onClick={onClose}>
							<svg className="invitation-actions__menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="m5 16.5-.8 3.3 3.3-.8L18 8.5 15.5 6 5 16.5Z" /><path d="m13.8 7.7 2.5 2.5" /></svg>
							<span>Editar invitación</span>
						</Link>
						<button
							role="menuitem"
							tabIndex={0}
							type="button"
							className={invitation.isArchived ? '' : 'invitation-actions__destructive'}
							onClick={() => { onClose(); setConfirmingArchive(true); }}
						>
							{invitation.isArchived ? (
								<svg className="invitation-actions__menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 8a8 8 0 1 1-1 7" /><path d="M5 3v5h5" /></svg>
							) : (
								<svg className="invitation-actions__menu-icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16v13H4z" /><path d="M3 4h18v3H3zM9 11h6" /></svg>
							)}
							<span>{invitation.isArchived ? 'Restaurar' : 'Archivar'}</span>
						</button>
					</div>
				)}
			</div>

			{confirmingArchive && createPortal(
				<div className="invitation-confirmation-backdrop">
					<div ref={dialog} className="invitation-confirmation-dialog" role="dialog" aria-modal="true" aria-label={`${invitation.isArchived ? 'Restaurar' : 'Archivar'} invitación`}>
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

export function InvitationList({ items, search, onInvitationChanged, onReloadRequested }: InvitationListProps) {
	const [openMenuId, setOpenMenuId] = useState<string | null>(null);

	return (
		<div className="invitation-table-shell">
			<table className="invitation-table">
				<caption className="visually-hidden">Listado de invitaciones</caption>
				<thead>
					<tr>
						<th id="invitation-col-name" scope="col">Familia / Nombre</th>
						<th id="invitation-col-code" scope="col">Código</th>
						<th id="invitation-col-guests" scope="col">Invitados</th>
						<th id="invitation-col-attendance" scope="col">Asistencia</th>
						<th id="invitation-col-status" scope="col">Estado</th>
						<th id="invitation-col-link" scope="col">Enlace</th>
						<th id="invitation-col-actions" scope="col">Acciones</th>
					</tr>
				</thead>
				<tbody>
					{items.map((invitation) => {
						const identified = invitation.guests.filter(hasName);
						const matchingGuests = matchedGuestNames(invitation, search);
						const attending = identified.filter((guest) => guest.attending === true).length;
						const declining = identified.filter((guest) => guest.attending === false).length;
						const updateLabel = updatedAtLabel(invitation.updatedAt);
						return (
							<tr
								key={invitation.id}
								className={[
									invitation.isArchived ? 'invitation-table__archived' : '',
									openMenuId === invitation.id ? 'invitation-table__menu-open' : '',
								].filter(Boolean).join(' ') || undefined}
							>
								<td headers="invitation-col-name" className="invitation-table__identity-cell">
									<div className="invitation-table__identity">
										<span className={`invitation-table__avatar invitation-table__avatar--${invitation.rsvpStatus}`} aria-hidden="true">{initials(invitation.displayName)}</span>
										<span className="invitation-table__identity-copy">
											<strong>{invitation.displayName}</strong>
											{matchingGuests.length > 0 && (
												<small className="invitation-table__guest-match" aria-label={`Coincidencia: ${matchingGuests.map(({ name }) => name).join(', ')}`}>
													<span aria-hidden="true">{matchingGuests.length === 1 ? 'Coincidencia: ' : 'Coincidencias: '}</span>
													{matchingGuests.slice(0, 2).map((match) => <MatchedGuestName key={`${match.name}-${match.matchStart}`} match={match} />)}
													{matchingGuests.length > 2 && <span aria-hidden="true"> +{matchingGuests.length - 2} más</span>}
												</small>
											)}
											{updateLabel && <small>Última actualización: {updateLabel}</small>}
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
								<td headers="invitation-col-status" className="invitation-table__status-cell">
									<span className="invitation-table__mobile-label" aria-hidden="true">Estado</span>
									<div className="invitation-table__status">
										<InvitationStatusBadge status={invitation.rsvpStatus} />
										{invitation.isArchived && <InvitationStatusBadge status="archived" />}
									</div>
								</td>
								<td headers="invitation-col-link"><span className="invitation-table__mobile-label" aria-hidden="true">Enlace</span><CopyInvitationLink invitation={invitation} /></td>
								<td headers="invitation-col-actions" className="invitation-table__actions-cell">
									<span className="invitation-table__mobile-label" aria-hidden="true">Acciones</span>
									<InvitationActions
										invitation={invitation}
										open={openMenuId === invitation.id}
										onToggle={() => setOpenMenuId((current) => current === invitation.id ? null : invitation.id)}
										onClose={() => setOpenMenuId(null)}
										onInvitationChanged={onInvitationChanged}
										onReloadRequested={onReloadRequested}
									/>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
