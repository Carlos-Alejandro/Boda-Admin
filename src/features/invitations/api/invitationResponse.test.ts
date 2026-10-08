import { describe, expect, it } from 'vitest';
import { parseInvitationListResponse, parseInvitationResponse } from './invitationResponse';

const invitation = (): Record<string, unknown> => ({
	id: 'ABC12345', version: 'iv1.aBc123', displayName: 'Familia Ruiz', maxGuests: 2,
	replacementsAllowed: true, rsvpStatus: 'pending', message: '', isArchived: false,
	archivedAt: null, updatedAt: '2026-09-20T18:07:00.000Z', editOverrideUntil: null,
	guests: [
		{ name: 'Ana Ruiz', shortName: 'Ana', type: 'known', attending: null },
		{ name: '', shortName: 'Acompañante', type: 'open', attending: false },
	],
});

describe('validación de respuestas de invitación', () => {
	it('acepta una invitación completa según el contrato, incluyendo nulos y campos opcionales', () => {
		const result = parseInvitationResponse(invitation());
		expect(result.guests[0].originalName).toBeUndefined();
		expect(result.archivedAt).toBeNull();
		expect(result.guests[1].attending).toBe(false);
	});

	it.each([
		['falta un campo requerido', (value: Record<string, unknown>) => { delete value.message; }],
		['el RSVP no pertenece a la enumeración', (value: Record<string, unknown>) => { value.rsvpStatus = 'unknown'; }],
		['una fecha tiene formato inválido', (value: Record<string, unknown>) => { value.updatedAt = 'ayer'; }],
		['una fecha tiene un día imposible', (value: Record<string, unknown>) => { value.updatedAt = '2026-02-30T10:00:00Z'; }],
		['un campo nullable requerido falta', (value: Record<string, unknown>) => { delete value.archivedAt; }],
		['un campo numérico tiene el tipo incorrecto', (value: Record<string, unknown>) => { value.maxGuests = '2'; }],
		['un invitado tiene asistencia con tipo inválido', (value: Record<string, unknown>) => { (value.guests as Array<Record<string, unknown>>)[0].attending = 'yes'; }],
		['la cantidad de invitados contradice la capacidad', (value: Record<string, unknown>) => { (value.guests as unknown[]).pop(); }],
	])('rechaza cuando %s', (_case, alter) => {
		const response = invitation();
		alter(response);
		expect(() => parseInvitationResponse(response)).toThrow(/Respuesta API inválida/);
	});

	it('rechaza listas sin paginación completa o con elementos inválidos', () => {
		expect(() => parseInvitationListResponse({ items: [], total: 0 })).toThrow(/lista de invitaciones/);
		expect(() => parseInvitationListResponse({ items: [{}], total: 1, page: 1, pageSize: 15, totalPages: 1 })).toThrow(/Respuesta API inválida/);
		expect(parseInvitationListResponse({ items: [invitation()], total: 1, page: 1, pageSize: 15, totalPages: 1 }).items).toHaveLength(1);
	});
});
