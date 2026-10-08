import type { Guest, Invitation, InvitationListResponse, RsvpStatus } from '../model/invitation.types';

const RSVP_STATUSES = new Set<string>(['pending', 'confirmed', 'partial', 'declined']);
const GUEST_TYPES = new Set<string>(['known', 'open', 'replacement']);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0;
}

function isRsvpStatus(value: unknown): value is RsvpStatus {
	return typeof value === 'string' && RSVP_STATUSES.has(value);
}

function isGuestType(value: unknown): value is Guest['type'] {
	return typeof value === 'string' && GUEST_TYPES.has(value);
}

function isPositiveInteger(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;
}

function isDateTime(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
	if (!match) return false;
	const [, year, month, day, hour, minute, second, , , offsetHour, offsetMinute] = match;
	const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
	return Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= daysInMonth &&
		Number(hour) <= 23 && Number(minute) <= 59 && Number(second) <= 59 &&
		(offsetHour === undefined || (Number(offsetHour) <= 23 && Number(offsetMinute) <= 59)) &&
		Number.isFinite(Date.parse(value));
}

function parseGuest(value: unknown, path: string): Guest {
	if (!isRecord(value) || typeof value.name !== 'string' || !isNonEmptyString(value.shortName) ||
		!isGuestType(value.type) ||
		(value.attending !== null && typeof value.attending !== 'boolean')) {
		throw new Error(`Respuesta API inválida: ${path}.`);
	}
	if (value.type === 'replacement' && !isNonEmptyString(value.originalName)) {
		throw new Error(`Respuesta API inválida: ${path}.`);
	}
	if (value.type !== 'replacement' && value.originalName !== undefined && typeof value.originalName !== 'string') {
		throw new Error(`Respuesta API inválida: ${path}.`);
	}
	return {
		name: value.name,
		shortName: value.shortName,
		type: value.type,
		attending: value.attending,
		...(typeof value.originalName === 'string' ? { originalName: value.originalName } : {}),
	};
}

export function parseInvitationResponse(value: unknown): Invitation {
	if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.version) ||
		!isNonEmptyString(value.displayName) || !isPositiveInteger(value.maxGuests) ||
		typeof value.replacementsAllowed !== 'boolean' || !isRsvpStatus(value.rsvpStatus) || typeof value.message !== 'string' ||
		typeof value.isArchived !== 'boolean' ||
		(value.archivedAt !== null && !isDateTime(value.archivedAt)) ||
		(value.updatedAt !== null && !isDateTime(value.updatedAt)) ||
		(value.editOverrideUntil !== null && !isDateTime(value.editOverrideUntil)) ||
		!Array.isArray(value.guests)) {
		throw new Error('Respuesta API inválida: invitación.');
	}
	const guests = value.guests.map((guest, index) => parseGuest(guest, `invitación.guests[${index}]`));
	if (guests.length !== value.maxGuests) throw new Error('Respuesta API inválida: capacidad de invitación.');
	return {
		id: value.id,
		version: value.version,
		displayName: value.displayName,
		maxGuests: value.maxGuests,
		replacementsAllowed: value.replacementsAllowed,
		rsvpStatus: value.rsvpStatus,
		message: value.message,
		isArchived: value.isArchived,
		archivedAt: value.archivedAt,
		updatedAt: value.updatedAt,
		editOverrideUntil: value.editOverrideUntil,
		guests,
	};
}

export function parseInvitationListResponse(value: unknown): InvitationListResponse {
	if (!isRecord(value) || !Array.isArray(value.items) || typeof value.total !== 'number' || !Number.isSafeInteger(value.total) || value.total < 0 ||
		typeof value.page !== 'number' || !Number.isSafeInteger(value.page) || value.page < 1 ||
		typeof value.pageSize !== 'number' || !Number.isSafeInteger(value.pageSize) || value.pageSize < 1 ||
		typeof value.totalPages !== 'number' || !Number.isSafeInteger(value.totalPages) || value.totalPages < 0) {
		throw new Error('Respuesta API inválida: lista de invitaciones.');
	}
	return {
		items: value.items.map(parseInvitationResponse),
		total: value.total,
		page: value.page,
		pageSize: value.pageSize,
		totalPages: value.totalPages,
	};
}
