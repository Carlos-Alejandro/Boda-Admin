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
		<aside className="m-4 rounded-xl border border-[#dfd4bd] bg-[#faf7ef] p-4 max-md:mx-5 min-[75rem]:m-[1.1rem] min-[75rem]:p-[1.05rem]" aria-label="Resumen de invitación">
			<div>
				<p className="m-0 text-admin-eyebrow font-extrabold tracking-[0.12em] text-[#927039] uppercase">Vista previa</p>
				<h2 className="mt-0.5 font-admin-serif text-[1.05rem] font-medium">Resumen de invitación</h2>
			</div>
			<dl className="mt-3.5 grid">
				<div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#dfd4bd] py-2">
					<dt className="text-xs text-admin-muted">Personas con nombre</dt>
					<dd className="m-0 font-admin-serif text-[1.2rem]">{namedPeopleCount}</dd>
				</div>
				<div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-[#dfd4bd] py-2">
					<dt className="text-xs text-admin-muted">Lugares adicionales</dt>
					<dd className="m-0 font-admin-serif text-[1.2rem]">{openSlots}</dd>
				</div>
				<div className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
					<dt className="text-xs text-admin-muted">Lugares totales</dt>
					<dd className="m-0 font-admin-serif text-[1.2rem] text-[#927039]">{total}</dd>
				</div>
			</dl>
			<p className="mt-3 inline-flex rounded-full bg-admin-green-100 px-2.5 py-1.5 text-xs font-bold text-admin-green-700">
				{replacementsAllowed
					? 'Sustituciones permitidas'
					: 'Sustituciones no permitidas'}
			</p>
		</aside>
	);
}
