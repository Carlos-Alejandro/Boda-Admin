import { CreateInvitationIcon } from './CreateInvitationIcon';

interface InvitationSummaryProps {
	namedPeopleCount: number;
	openSlots: number;
	total: number;
	replacementsAllowed: boolean;
}

export function InvitationSummary({
	namedPeopleCount,
	openSlots,
	total,
	replacementsAllowed,
}: InvitationSummaryProps) {
	return (
		<aside className="create-invitation-summary" aria-label="Resumen de invitación">
			<span className="create-invitation-summary__icon"><CreateInvitationIcon kind="people" /></span>
			<h2>Resumen de la invitación</h2>
			<dl className="create-invitation-summary__list">
				<div><dt>Personas con nombre</dt><dd>{namedPeopleCount}</dd></div>
				<div><dt>Lugares adicionales</dt><dd>{openSlots}</dd></div>
				<div><dt>Lugares totales</dt><dd>{total}</dd></div>
			</dl>
			<p className="create-invitation-summary__replacement">
				{replacementsAllowed ? 'Sustituciones permitidas' : 'Sustituciones no permitidas'}
			</p>
		</aside>
	);
}
