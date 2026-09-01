import { useEffect, useState } from 'react';

import { getInvitations } from '../api/invitationService';
import type { InvitationListResponse } from '../model/invitation.types';

export function InvitationListPage() {
	const [response, setResponse] = useState<InvitationListResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		let active = true;

		const loadInvitations = async () => {
			try {
				const invitationList = await getInvitations();

				if (!active) return;
				setResponse(invitationList);
				setError(false);
			} catch {
				if (!active) return;
				setError(true);
			} finally {
				if (active) setLoading(false);
			}
		};

		void loadInvitations();

		return () => {
			active = false;
		};
	}, []);

	if (loading) {
		return <p>Cargando invitaciones...</p>;
	}

	if (error || !response) {
		return <p className="error-message">No fue posible cargar las invitaciones.</p>;
	}

	if (response.total === 0 || response.items.length === 0) {
		return (
			<section aria-labelledby="invitations-title">
				<h1 id="invitations-title">Invitaciones</h1>
				<p>No hay invitaciones para mostrar.</p>
			</section>
		);
	}

	return (
		<section aria-labelledby="invitations-title">
			<h1 id="invitations-title">Invitaciones</h1>
			<p>{response.total} invitaciones</p>

			<ul className="invitation-list">
				{response.items.map((invitation) => (
					<li className="invitation-list-item" key={invitation.id}>
						<h2>{invitation.displayName}</h2>
						<p>{invitation.id}</p>
						<p>
							{invitation.maxGuests}{' '}
							{invitation.maxGuests === 1 ? 'invitado' : 'invitados'}
						</p>
						<p>{invitation.rsvpStatus}</p>
						<p>{invitation.isArchived ? 'Archivada' : 'Activa'}</p>
					</li>
				))}
			</ul>
		</section>
	);
}
