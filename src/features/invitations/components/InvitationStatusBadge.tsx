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
}

export function InvitationStatusBadge({ status }: InvitationStatusBadgeProps) {
	const label = status === 'active'
		? 'Activa'
		: status === 'archived'
			? 'Archivada'
			: rsvpLabels[status];

	return (
		<span className={`rounded-full px-2 py-1 text-xs font-bold ${statusClassNames[status]}`}>
			{label}
		</span>
	);
}
