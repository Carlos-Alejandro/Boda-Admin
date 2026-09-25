import { useEffect, useRef, useState } from 'react';

import { Button, ButtonLink } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { getInvitations } from '../api/invitationService';
import { InvitationFilters } from '../components/InvitationFilters';
import { InvitationList } from '../components/InvitationList';
import type { Invitation, InvitationListResponse, RsvpStatus } from '../model/invitation.types';
import './InvitationListPage.css';

const filtersId = 'invitation-list-filters';
const filtersTitleId = 'invitation-list-filters-title';

export function InvitationListPage() {
	const [response, setResponse] = useState<InvitationListResponse | null>(null);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | ''>('');
	const [archived, setArchived] = useState<boolean | undefined>();
	const [draftRsvpStatus, setDraftRsvpStatus] = useState<RsvpStatus | ''>('');
	const [draftArchived, setDraftArchived] = useState<boolean | undefined>();
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [refreshToken, setRefreshToken] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const requestSequence = useRef(0);
	const filterControl = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
		return () => window.clearTimeout(timeout);
	}, [search]);

	useEffect(() => {
		const requestId = ++requestSequence.current;

		const loadInvitations = async () => {
			setLoading(true);
			setError(false);
			try {
				const invitationList = await getInvitations({
					search: debouncedSearch || undefined,
					rsvpStatus: rsvpStatus || undefined,
					archived,
				});
				if (requestId === requestSequence.current) setResponse(invitationList);
			} catch {
				if (requestId === requestSequence.current) setError(true);
			} finally {
				if (requestId === requestSequence.current) setLoading(false);
			}
		};

		void loadInvitations();
		return () => { requestSequence.current += 1; };
	}, [archived, debouncedSearch, refreshToken, rsvpStatus]);

	useEffect(() => {
		if (!filtersOpen) return;
		const discardAndClose = () => {
			setDraftRsvpStatus(rsvpStatus);
			setDraftArchived(archived);
			setFiltersOpen(false);
		};
		const closeOnOutsideClick = (event: MouseEvent) => {
			if (!filterControl.current?.contains(event.target as Node)) discardAndClose();
		};
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			event.preventDefault();
			discardAndClose();
			filterControl.current?.querySelector<HTMLButtonElement>('.invitation-toolbar__filter')?.focus();
		};
		document.addEventListener('mousedown', closeOnOutsideClick);
		document.addEventListener('keydown', closeOnEscape);
		return () => {
			document.removeEventListener('mousedown', closeOnOutsideClick);
			document.removeEventListener('keydown', closeOnEscape);
		};
	}, [archived, filtersOpen, rsvpStatus]);

	const hasAppliedFilters = rsvpStatus !== '' || archived !== undefined;
	const hasActiveFilters = search.trim() !== '' || hasAppliedFilters;
	const hasDraftChanges = draftRsvpStatus !== rsvpStatus || draftArchived !== archived;

	const toggleFilters = () => {
		if (filtersOpen) {
			setDraftRsvpStatus(rsvpStatus);
			setDraftArchived(archived);
			setFiltersOpen(false);
			return;
		}
		setDraftRsvpStatus(rsvpStatus);
		setDraftArchived(archived);
		setFiltersOpen(true);
	};

	const applyFilters = () => {
		if (!hasDraftChanges) return;
		setRsvpStatus(draftRsvpStatus);
		setArchived(draftArchived);
		setFiltersOpen(false);
	};

	const clearFilters = () => {
		if (!hasAppliedFilters) return;
		setRsvpStatus('');
		setArchived(undefined);
		setDraftRsvpStatus('');
		setDraftArchived(undefined);
		setFiltersOpen(false);
	};

	const updateInvitation = (updated: Invitation) => {
		setResponse((current) => {
			if (!current) return current;
			const existing = current.items.some((item) => item.id === updated.id);
			const remainsInArchiveFilter = archived === undefined || updated.isArchived === archived;
			if (!remainsInArchiveFilter) {
				return {
					items: current.items.filter((item) => item.id !== updated.id),
					total: existing ? Math.max(0, current.total - 1) : current.total,
				};
			}
			return {
				...current,
				items: current.items.map((item) => item.id === updated.id ? updated : item),
			};
		});
	};

	return (
		<section className="invitation-list-page" aria-labelledby="invitations-title">
			<PageHeader
				eyebrow="Nuestra boda"
				title="Invitaciones"
				titleId="invitations-title"
				description="Administra, busca y gestiona las invitaciones de tu boda."
			/>

			<div className="invitation-toolbar" aria-label="Herramientas de invitaciones">
				<label className="invitation-search">
					<span className="visually-hidden">Buscar invitaciones</span>
					<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
					<input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por familia, invitado o código..."
					/>
				</label>

				<div className="invitation-filter-control" ref={filterControl}>
					<Button
						className={`invitation-toolbar__filter${hasAppliedFilters ? ' invitation-toolbar__filter--active' : ''}`}
						variant="secondary"
						type="button"
						aria-expanded={filtersOpen}
						aria-controls={filtersId}
						onClick={toggleFilters}
					>
						<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16l-6.2 7.1v5.4l-3.6 1.8v-7.2L4 5Z" /></svg>
						Filtros
					</Button>
					<div
						id={filtersId}
						className={`invitation-filter-panel${filtersOpen ? ' invitation-filter-panel--open' : ''}`}
						role="dialog"
						aria-labelledby={filtersTitleId}
						aria-hidden={!filtersOpen}
						inert={!filtersOpen}
					>
						<p className="invitation-filter-panel__title" id={filtersTitleId}>Filtrar invitaciones</p>
						<InvitationFilters
							rsvpStatus={draftRsvpStatus}
							archived={draftArchived}
							hasAppliedFilters={hasAppliedFilters}
							hasDraftChanges={hasDraftChanges}
							onRsvpStatusChange={(event) => setDraftRsvpStatus(event.target.value as RsvpStatus | '')}
							onArchivedChange={(event) => {
								const value = event.target.value;
								setDraftArchived(value === '' ? undefined : value === 'true');
							}}
							onApply={applyFilters}
							onClear={clearFilters}
						/>
					</div>
				</div>
				<ButtonLink className="invitation-toolbar__import" variant="secondary" to="/invitaciones/importar">
					<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 15V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" /></svg>
					Importar Excel
				</ButtonLink>
				<ButtonLink className="invitation-toolbar__create" variant="primary" to="/invitaciones/nueva">
					<span aria-hidden="true">＋</span> Nueva invitación
				</ButtonLink>
			</div>

			{loading && <p role="status" className="invitation-list-state">Cargando invitaciones...</p>}
			{!loading && (error || !response) && <p role="alert" className="invitation-list-state invitation-list-state--error">No fue posible cargar las invitaciones.</p>}
			{!loading && !error && response?.items.length === 0 && (
				<p className="invitation-list-state">
					{hasActiveFilters ? 'No se encontraron invitaciones con estos filtros.' : 'No hay invitaciones.'}
				</p>
			)}
			{!loading && !error && response && response.items.length > 0 && (
				<InvitationList
					items={response.items}
					onInvitationChanged={updateInvitation}
					onReloadRequested={() => setRefreshToken((token) => token + 1)}
				/>
			)}
			<div className="invitation-list-summary" aria-live="polite">
				{response && !loading && response.total > 0 && (
					<p>Mostrando {response.items.length} de {response.total} {response.total === 1 ? 'invitación' : 'invitaciones'}</p>
				)}
			</div>
		</section>
	);
}
