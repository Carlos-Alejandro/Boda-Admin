import { useEffect, useRef, useState } from 'react';

import { getInvitations } from '../api/invitationService';
import type {
	InvitationListResponse,
	RsvpStatus,
} from '../model/invitation.types';

const rsvpLabels: Record<RsvpStatus, string> = {
	pending: 'Pendiente',
	confirmed: 'Confirmada',
	partial: 'Parcial',
	declined: 'Declinada',
};

export function InvitationListPage() {
	const [response, setResponse] = useState<InvitationListResponse | null>(null);
	const [search, setSearch] = useState('');
	const [debouncedSearch, setDebouncedSearch] = useState('');
	const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | ''>('');
	const [archived, setArchived] = useState<boolean | undefined>();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);
	const requestSequence = useRef(0);

	useEffect(() => {
		const timeout = window.setTimeout(() => {
			setDebouncedSearch(search.trim());
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
				});

				if (requestId !== requestSequence.current) return;
				setResponse(invitationList);
			} catch {
				if (requestId !== requestSequence.current) return;
				setError(true);
			} finally {
				if (requestId === requestSequence.current) setLoading(false);
			}
		};

		void loadInvitations();

		return () => {
			requestSequence.current += 1;
		};
	}, [archived, debouncedSearch, rsvpStatus]);

	const hasActiveFilters =
		search.trim() !== '' || rsvpStatus !== '' || archived !== undefined;

	const clearFilters = () => {
		setSearch('');
		setDebouncedSearch('');
		setRsvpStatus('');
		setArchived(undefined);
	};

	return (
		<section aria-labelledby="invitations-title">
			<h1 id="invitations-title">Invitaciones</h1>
			{response && (
				<p>
					{response.total}{' '}
					{response.total === 1 ? 'invitación' : 'invitaciones'}
				</p>
			)}

			<div className="invitation-filters">
				<label>
					Buscar
					<input
						type="search"
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por nombre o código..."
					/>
				</label>

				<label>
					Estado RSVP
					<select
						value={rsvpStatus}
						onChange={(event) =>
							setRsvpStatus(event.target.value as RsvpStatus | '')
						}
					>
						<option value="">Todos</option>
						<option value="pending">Pendientes</option>
						<option value="confirmed">Confirmadas</option>
						<option value="partial">Parciales</option>
						<option value="declined">Declinadas</option>
					</select>
				</label>

				<label>
					Estado
					<select
						value={archived === undefined ? '' : String(archived)}
						onChange={(event) => {
							const value = event.target.value;
							setArchived(value === '' ? undefined : value === 'true');
						}}
					>
						<option value="">Todas</option>
						<option value="false">Activas</option>
						<option value="true">Archivadas</option>
					</select>
				</label>

				<button type="button" onClick={clearFilters} disabled={!hasActiveFilters}>
					Limpiar filtros
				</button>
			</div>

			{loading && <p>Cargando invitaciones...</p>}

			{!loading && (error || !response) && (
				<p className="error-message">No fue posible cargar las invitaciones.</p>
			)}

			{!loading && !error && response && response.items.length === 0 && (
				<p>
					{hasActiveFilters
						? 'No se encontraron invitaciones con estos filtros.'
						: 'No hay invitaciones.'}
				</p>
			)}

			{!loading && !error && response && response.items.length > 0 && (
				<ul className="invitation-list">
					{response.items.map((invitation) => (
					<li className="invitation-list-item" key={invitation.id}>
						<h2>{invitation.displayName}</h2>
						<p>{invitation.id}</p>
						<p>
							{invitation.maxGuests}{' '}
							{invitation.maxGuests === 1 ? 'invitado' : 'invitados'}
						</p>
						<p>{rsvpLabels[invitation.rsvpStatus]}</p>
						<p>{invitation.isArchived ? 'Archivada' : 'Activa'}</p>
					</li>
					))}
				</ul>
			)}
		</section>
	);
}
