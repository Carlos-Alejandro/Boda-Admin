import { Link } from 'react-router-dom';
import type { Invitation } from '../model/invitation.types';
import { InvitationStatusBadge } from './InvitationStatusBadge';

interface InvitationListProps {
	items: Invitation[];
}

export function InvitationList({ items }: InvitationListProps) {
	return (
		<ul className="m-0 grid list-none gap-2 p-0">
			{items.map((invitation) => (
				<li className="grid grid-cols-[minmax(14rem,2fr)_minmax(7rem,0.7fr)_minmax(12rem,1fr)] items-center gap-3.5 rounded-[0.65rem] border border-admin-border bg-surface px-3.5 py-3 transition hover:border-[#d2c7b3] hover:shadow-[0_0.5rem_1.5rem_rgba(34,54,45,0.055)] max-md:grid-cols-[minmax(0,1fr)_auto] max-[36rem]:grid-cols-1 max-[36rem]:gap-2" key={invitation.id}>
					<h2 className="m-0 font-admin-serif text-[0.95rem] font-medium">{invitation.displayName}</h2>
					<p className="m-0 text-xs font-bold tracking-[0.06em] text-[#87918c]">{invitation.id}</p>
					<p className="m-0 text-[0.8rem] text-admin-muted max-md:col-start-1 max-[36rem]:col-auto">
						{invitation.maxGuests}{' '}
						{invitation.maxGuests === 1 ? 'invitado' : 'invitados'}
					</p>
					<div className="flex flex-wrap justify-end gap-1.5 max-md:col-start-2 max-md:row-span-2 max-md:row-start-1 max-[36rem]:col-auto max-[36rem]:row-auto max-[36rem]:justify-start">
						<InvitationStatusBadge status={invitation.rsvpStatus} />
						<InvitationStatusBadge status={invitation.isArchived ? 'archived' : 'active'} />
						<Link
							className="inline-flex min-h-9 items-center px-1 text-xs font-semibold text-admin-green-700 underline underline-offset-4"
							to={`/invitaciones/${encodeURIComponent(invitation.id)}`}
							aria-label={`Ver detalle de ${invitation.displayName}`}
						>
							Ver detalle
						</Link>
					</div>
				</li>
			))}
		</ul>
	);
}
