const timeZone = 'America/Cancun';
const partsFormatter = new Intl.DateTimeFormat('en-CA', {
	timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
	hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
const displayFormatter = new Intl.DateTimeFormat('es-MX', {
	timeZone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true,
});

function parts(date: Date) {
	const values = Object.fromEntries(partsFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
	return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}:${values.second}`;
}

export function formatCancunDate(iso: string): string {
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : displayFormatter.format(date);
}

export function toCancunInput(iso: string | null): string {
	if (!iso) return '';
	const date = new Date(iso);
	return Number.isNaN(date.getTime()) ? '' : parts(date);
}

export function cancunInputToIso(value: string): string | null {
	if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
	const wall = value.length === 16 ? `${value}:00` : value;
	// Treat components as UTC only to do arithmetic, then resolve the IANA zone with Intl.
	const target = new Date(`${wall}Z`);
	if (Number.isNaN(target.getTime()) || target.toISOString().slice(0, 19) !== wall) return null;
	let instant = target.getTime();
	for (let attempt = 0; attempt < 4; attempt++) {
		const rendered = parts(new Date(instant));
		if (rendered === wall) return new Date(instant).toISOString();
		instant += target.getTime() - new Date(`${rendered}Z`).getTime();
	}
	// Reject local times that cannot be represented; never silently shift the selection.
	return null;
}
