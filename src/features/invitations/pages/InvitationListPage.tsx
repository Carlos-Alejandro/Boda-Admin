import { useEffect, useRef, useState } from 'react';
import { ButtonLink } from '../../../shared/components/Button/Button';
import { PageHeader } from '../../../shared/components/PageHeader/PageHeader';
import { getInvitations } from '../api/invitationService';
import { InvitationFilters } from '../components/InvitationFilters';
import { InvitationList } from '../components/InvitationList';
import type {
	InvitationListResponse,
	RsvpStatus,
} from '../model/invitation.types';

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
		<section className="w-full text-[0.9rem] max-md:text-[0.9375rem]" aria-labelledby="invitations-title">
			<PageHeader
				eyebrow="Gestión de invitados"
				title="Invitaciones"
				titleId="invitations-title"
				description="Consulta, busca y filtra las invitaciones de la boda."
				action={(
				<ButtonLink variant="primary" to="/invitaciones/nueva">
					Nueva invitación
				</ButtonLink>
			)}
			/>
			{response && (
				<p className="mt-4.5 mb-0 text-[0.84rem] font-semibold text-admin-muted">
					{response.total}{' '}
					{response.total === 1 ? 'invitación' : 'invitaciones'}
				</p>
			)}

			<InvitationFilters
				search={search}
				rsvpStatus={rsvpStatus}
				archived={archived}
				hasActiveFilters={hasActiveFilters}
				onSearchChange={(event) => setSearch(event.target.value)}
				onRsvpStatusChange={(event) => setRsvpStatus(event.target.value as RsvpStatus | '')}
				onArchivedChange={(event) => {
					const value = event.target.value;
					setArchived(value === '' ? undefined : value === 'true');
				}}
				onClear={clearFilters}
			/>

			{loading && <p className="mt-4 rounded-xl border border-dashed border-[#d7d0c2] px-4 py-10 text-center text-admin-muted">Cargando invitaciones...</p>}

			{!loading && (error || !response) && (
				<p className="mt-4 rounded-xl border border-dashed border-[#d7d0c2] px-4 py-10 text-center text-admin-danger">No fue posible cargar las invitaciones.</p>
			)}

			{!loading && !error && response && response.items.length === 0 && (
				<p className="mt-4 rounded-xl border border-dashed border-[#d7d0c2] px-4 py-10 text-center text-admin-muted">
					{hasActiveFilters
						? 'No se encontraron invitaciones con estos filtros.'
						: 'No hay invitaciones.'}
				</p>
			)}

			{!loading && !error && response && response.items.length > 0 && (
				<InvitationList items={response.items} />
			)}
		</section>
	);
}
