import type { ChangeEventHandler } from 'react';

import { Button } from '../../../shared/components/Button/Button';
import type { RsvpStatus } from '../model/invitation.types';

interface InvitationFiltersProps {
	search: string;
	rsvpStatus: RsvpStatus | '';
	archived: boolean | undefined;
	hasActiveFilters: boolean;
	onSearchChange: ChangeEventHandler<HTMLInputElement>;
	onRsvpStatusChange: ChangeEventHandler<HTMLSelectElement>;
	onArchivedChange: ChangeEventHandler<HTMLSelectElement>;
	onClear: () => void;
}

export function InvitationFilters({
	search,
	rsvpStatus,
	archived,
	hasActiveFilters,
	onSearchChange,
	onRsvpStatusChange,
	onArchivedChange,
	onClear,
}: InvitationFiltersProps) {
	return (
		<div className="my-3 grid grid-cols-[minmax(14rem,2fr)_repeat(2,minmax(9rem,1fr))_auto] items-end gap-2.5 rounded-xl border border-admin-border bg-surface p-3 max-[64rem]:grid-cols-2 max-[36rem]:grid-cols-1" aria-label="Filtros de invitaciones">
			<label className="grid gap-1.5 text-[0.8rem] font-bold text-[#45584f]">
				Buscar
				<input className="min-h-10 w-full rounded-lg border border-[#cfc8b9] bg-white px-3 py-2 text-sm text-admin-green-950 outline-none transition-shadow focus-visible:border-admin-gold focus-visible:shadow-[0_0_0_3px_rgba(169,132,69,0.15)] max-md:min-h-[2.65rem] max-md:text-base"
					type="search"
					value={search}
					onChange={onSearchChange}
					placeholder="Buscar por nombre o código..."
				/>
			</label>

			<label className="grid gap-1.5 text-[0.8rem] font-bold text-[#45584f]">
				Estado RSVP
				<select className="min-h-10 w-full rounded-lg border border-[#cfc8b9] bg-white px-3 py-2 text-sm text-admin-green-950 outline-none transition-shadow focus-visible:border-admin-gold focus-visible:shadow-[0_0_0_3px_rgba(169,132,69,0.15)] max-md:min-h-[2.65rem] max-md:text-base" value={rsvpStatus} onChange={onRsvpStatusChange}>
					<option value="">Todos</option>
					<option value="pending">Pendientes</option>
					<option value="confirmed">Confirmadas</option>
					<option value="partial">Parciales</option>
					<option value="declined">Declinadas</option>
				</select>
			</label>

			<label className="grid gap-1.5 text-[0.8rem] font-bold text-[#45584f]">
				Estado
				<select className="min-h-10 w-full rounded-lg border border-[#cfc8b9] bg-white px-3 py-2 text-sm text-admin-green-950 outline-none transition-shadow focus-visible:border-admin-gold focus-visible:shadow-[0_0_0_3px_rgba(169,132,69,0.15)] max-md:min-h-[2.65rem] max-md:text-base"
					value={archived === undefined ? '' : String(archived)}
					onChange={onArchivedChange}
				>
					<option value="">Todas</option>
					<option value="false">Activas</option>
					<option value="true">Archivadas</option>
				</select>
			</label>

			<Button variant="secondary" type="button" onClick={onClear} disabled={!hasActiveFilters}>
				Limpiar filtros
			</Button>
		</div>
	);
}
