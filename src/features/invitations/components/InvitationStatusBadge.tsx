import type { RsvpStatus } from '../model/invitation.types';

const rsvpLabels: Record<RsvpStatus, string> = {
	pending: 'Pendiente',
	confirmed: 'Confirmada',
	partial: 'Parcial',
	declined: 'Declinada',
};

const statusClassNames = {
	pending: 'bg-[#f4ecda] text-[#826421]',
	confirmed: 'bg-[#e4efe8] text-[#38634e]',
	partial: 'bg-[#ebe8f2] text-[#625879]',
	declined: 'bg-[#f3e8e5] text-[#8a4c3e]',
	active: 'bg-[#e4efe8] text-[#38634e]',
	archived: 'bg-[#f3e8e5] text-[#8a4c3e]',
} as const;

interface InvitationStatusBadgeProps {
	status: RsvpStatus | 'active' | 'archived';
	variant?: 'default' | 'prominent';
}

function StatusIcon({ status }: { status: RsvpStatus }) {
	const paths = {
		pending: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
		confirmed: <path d="m5 12 4 4L19 6" />,
		partial: <><circle cx="12" cy="12" r="9" /><path d="M12 3v9h9" /></>,
		declined: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6m0-6-6 6" /></>,
	};
	return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[status]}</svg>;
}

export function InvitationStatusBadge({ status, variant = 'default' }: InvitationStatusBadgeProps) {
	const label = status === 'active'
		? 'Activa'
		: status === 'archived'
			? 'Archivada'
			: rsvpLabels[status];
	const isRsvp = status !== 'active' && status !== 'archived';

	return (
		<span className={`invitation-status-badge rounded-full px-2 py-1 text-xs font-bold ${statusClassNames[status]}${variant === 'prominent' ? ` invitation-status-badge--prominent invitation-status-badge--${status}` : ''}`}>
			{variant === 'prominent' && isRsvp && <span className="invitation-status-badge__icon"><StatusIcon status={status} /></span>}
			{label}
		</span>
	);
}
