import type { ChangeEventHandler } from 'react';

import { Button } from '../../../shared/components/Button/Button';
import type { RsvpStatus } from '../model/invitation.types';

interface InvitationFiltersProps {
	rsvpStatus: RsvpStatus | '';
	archived: boolean | undefined;
	hasAppliedFilters: boolean;
	hasDraftChanges: boolean;
	onRsvpStatusChange: ChangeEventHandler<HTMLSelectElement>;
	onArchivedChange: ChangeEventHandler<HTMLSelectElement>;
	onApply: () => void;
	onClear: () => void;
}

export function InvitationFilters({
	rsvpStatus,
	archived,
	hasAppliedFilters,
	hasDraftChanges,
	onRsvpStatusChange,
	onArchivedChange,
	onApply,
	onClear,
}: InvitationFiltersProps) {
	return (
		<div className="invitation-filters">
			<label className="invitation-filters__field">
				<span>Estado RSVP</span>
				<select value={rsvpStatus} onChange={onRsvpStatusChange}>
					<option value="">Todos</option>
					<option value="pending">Pendientes</option>
					<option value="confirmed">Confirmadas</option>
					<option value="partial">Parciales</option>
					<option value="declined">Declinadas</option>
				</select>
			</label>

			<label className="invitation-filters__field">
				<span>Estado de invitación</span>
				<select
					value={archived === undefined ? '' : String(archived)}
					onChange={onArchivedChange}
				>
					<option value="">Todas</option>
					<option value="false">Activas</option>
					<option value="true">Archivadas</option>
				</select>
			</label>

			<div className="invitation-filters__actions">
				<Button className="invitation-filters__clear" variant="secondary" type="button" onClick={onClear} disabled={!hasAppliedFilters}>
					Limpiar
				</Button>
				<Button className="invitation-filters__apply" variant="primary" type="button" onClick={onApply} disabled={!hasDraftChanges}>
					Aplicar filtros
				</Button>
			</div>
		</div>
	);
}
