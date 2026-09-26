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
const pageSize = 15;

function paginationItems(current: number, total: number): Array<number | 'ellipsis-start' | 'ellipsis-end'> {
	if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
	const pages = new Set([1, total, current - 1, current, current + 1]);
	const visible = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
	const result: Array<number | 'ellipsis-start' | 'ellipsis-end'> = [];
	visible.forEach((page, index) => {
		const previous = visible[index - 1];
		if (previous !== undefined && page - previous > 1) {
			result.push(previous === 1 ? 'ellipsis-start' : 'ellipsis-end');
		}
		result.push(page);
	});
	return result;
}

function InvitationListSkeleton() {
	return (
		<div className="invitation-skeleton" role="status" aria-live="polite" aria-label="Cargando invitaciones">
			<span className="visually-hidden">Cargando invitaciones...</span>
			<div className="invitation-skeleton__visual" aria-hidden="true">
				<div className="invitation-skeleton__header">
					{Array.from({ length: 7 }, (_, index) => <span key={index} />)}
				</div>
				{Array.from({ length: 5 }, (_, row) => (
					<div className="invitation-skeleton__row" key={row}>
						{Array.from({ length: 7 }, (_, cell) => (
							<span className={`invitation-skeleton__cell invitation-skeleton__cell--${cell + 1}`} key={cell}>
								<i />
								{cell === 0 && <i />}
							</span>
						))}
					</div>
				))}
			</div>
		</div>
	);
}

interface InvitationEmptyStateProps {
	hasSearch: boolean;
	hasAppliedFilters: boolean;
	onClearFilters: () => void;
	onClearSearch: () => void;
}

function InvitationEmptyState({ hasSearch, hasAppliedFilters, onClearFilters, onClearSearch }: InvitationEmptyStateProps) {
	const constrained = hasSearch || hasAppliedFilters;
	return (
		<section className="invitation-empty" aria-labelledby="invitation-empty-title">
			<span className="invitation-empty__icon" aria-hidden="true">
				<svg viewBox="0 0 24 24"><path d="M4 6.5h16v11H4z" /><path d="m4.5 7 7.5 6 7.5-6" /></svg>
			</span>
			<div role="status">
				<h2 id="invitation-empty-title">{constrained ? 'No encontramos invitaciones' : 'Aún no hay invitaciones'}</h2>
				<p>{constrained ? 'Prueba con otra búsqueda o ajusta los filtros aplicados.' : 'Crea tu primera invitación o impórtalas desde Excel.'}</p>
			</div>
			<div className="invitation-empty__actions">
				{hasAppliedFilters && <Button variant="secondary" type="button" onClick={onClearFilters}>Limpiar filtros</Button>}
				{hasSearch && <Button variant="secondary" type="button" onClick={onClearSearch}>Limpiar búsqueda</Button>}
				{!constrained && (
					<>
						<ButtonLink variant="primary" to="/invitaciones/nueva">Nueva invitación</ButtonLink>
						<ButtonLink variant="secondary" to="/invitaciones/importar">Importar Excel</ButtonLink>
					</>
				)}
			</div>
		</section>
	);
}

export function InvitationListPage() {
	const [response, setResponse] = useState<InvitationListResponse | null>(null);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | ''>('');
	const [archived, setArchived] = useState<boolean | undefined>();
	const [page, setPage] = useState(1);
	const [draftRsvpStatus, setDraftRsvpStatus] = useState<RsvpStatus | ''>('');
	const [draftArchived, setDraftArchived] = useState<boolean | undefined>();
	const [filtersOpen, setFiltersOpen] = useState(false);
	const [refreshToken, setRefreshToken] = useState(0);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const requestSequence = useRef(0);
	const filterControl = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			setDebouncedSearch(search.trim());
			setPage(1);
		}, 400);
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
					page,
					pageSize,
				});
				if (requestId === requestSequence.current) {
					setResponse(invitationList);
					if (invitationList.page !== undefined && invitationList.page !== page) setPage(invitationList.page);
				}
			} catch {
				if (requestId === requestSequence.current) setError(true);
			} finally {
				if (requestId === requestSequence.current) setLoading(false);
			}
		};

		void loadInvitations();
		return () => { requestSequence.current += 1; };
	}, [archived, debouncedSearch, page, refreshToken, rsvpStatus]);

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
	const appliedFilterCount = Number(rsvpStatus !== '') + Number(archived !== undefined);
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
		setPage(1);
		setFiltersOpen(false);
	};

	const clearFilters = () => {
		if (!hasAppliedFilters) return;
		setRsvpStatus('');
		setArchived(undefined);
		setDraftRsvpStatus('');
		setDraftArchived(undefined);
		setPage(1);
		setFiltersOpen(false);
	};

	const clearSearch = () => {
		setSearch('');
		setDebouncedSearch('');
		setPage(1);
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
		setRefreshToken((token) => token + 1);
	};

	const responsePage = response?.page ?? page;
	const responsePageSize = response?.pageSize ?? pageSize;
	const responseTotalPages = response?.totalPages ?? (response ? Math.ceil(response.total / responsePageSize) : 0);

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
						aria-label={appliedFilterCount === 0 ? 'Filtros' : `Filtros, ${appliedFilterCount} ${appliedFilterCount === 1 ? 'filtro activo' : 'filtros activos'}`}
						aria-expanded={filtersOpen}
						aria-controls={filtersId}
						onClick={toggleFilters}
					>
						<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 5h16l-6.2 7.1v5.4l-3.6 1.8v-7.2L4 5Z" /></svg>
						<span>Filtros</span>
						{appliedFilterCount > 0 && <span className="invitation-toolbar__filter-count" aria-hidden="true">{appliedFilterCount}</span>}
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

			{loading && <InvitationListSkeleton />}
			{!loading && (error || !response) && <p role="alert" className="invitation-list-state invitation-list-state--error">No fue posible cargar las invitaciones.</p>}
			{!loading && !error && response?.items.length === 0 && (
				<InvitationEmptyState
					hasSearch={search.trim() !== ''}
					hasAppliedFilters={hasAppliedFilters}
					onClearFilters={clearFilters}
					onClearSearch={clearSearch}
				/>
			)}
			{!loading && !error && response && response.items.length > 0 && (
				<InvitationList
					items={response.items}
					search={debouncedSearch}
					onInvitationChanged={updateInvitation}
					onReloadRequested={() => setRefreshToken((token) => token + 1)}
				/>
			)}
			<div className="invitation-list-summary" aria-live="polite">
				{response && !loading && response.total > 0 && (
					<>
						<p>Mostrando {(responsePage - 1) * responsePageSize + 1}–{Math.min(responsePage * responsePageSize, response.total)} de {response.total} {response.total === 1 ? 'invitación' : 'invitaciones'}</p>
						<nav className="invitation-pagination" aria-label="Paginación de invitaciones">
							<button type="button" disabled={responsePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button>
							<div className="invitation-pagination__pages">
								{paginationItems(responsePage, responseTotalPages).map((item) => typeof item === 'number' ? (
									<button
										key={item}
										type="button"
										aria-label={`Ir a la página ${item}`}
										aria-current={item === responsePage ? 'page' : undefined}
										onClick={() => setPage(item)}
									>{item}</button>
								) : <span key={item} aria-hidden="true">…</span>)}
							</div>
							<button type="button" disabled={responsePage >= responseTotalPages} onClick={() => setPage((current) => Math.min(responseTotalPages, current + 1))}>Siguiente</button>
						</nav>
					</>
				)}
			</div>
		</section>
	);
}
