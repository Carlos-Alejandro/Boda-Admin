import { describe, expect, it } from 'vitest';
import { guest, invitation } from '../../../../tests/dashboardTestSupport';
import { calculateDashboardMetrics } from './calculateDashboardMetrics';
import { buildDashboardDetails } from './buildDashboardDetails';

describe('métricas del Dashboard', () => {
 it.each(['confirmed', 'partial', 'pending', 'declined'] as const)('reconcilia personas, respuestas, 33 cupos y estado %s sin sumar archivadas', rsvpStatus => {
  const guests = [
   ...(['known', 'open', 'replacement'] as const).flatMap(type => [guest(`${type} sí`, true, type), guest(`${type} no`, false, type), guest(`${type} pendiente`, null, type)]),
   guest('', null, 'open'), guest('  ', false, 'open'),
  ];
  const items = ['A', 'B', 'C'].map(id => invitation(id, { guests: structuredClone(guests), maxGuests: guests.length, rsvpStatus }));
  items.push(invitation('ARCH', { guests, maxGuests: guests.length, rsvpStatus, isArchived: true }));
  const m = calculateDashboardMetrics(items);
  expect(m).toMatchObject({ currentSlots: 33, identifiedPeople: 27, attending: 9, notAttending: 9, unanswered: 9, responded: 18, unassignedSpaces: 6, currentReplacements: 9, activeInvitations: 3, archivedInvitations: 1, invitationsWithUnanswered: 3 });
  expect(m.identifiedPeople).toBe(m.attending + m.notAttending + m.unanswered);
  expect(m.responded).toBe(m.attending + m.notAttending);
  expect(m.responseRate).toBe(m.responded / m.identifiedPeople * 100);
  expect(m.activeInvitations).toBe(Object.values(m.rsvp).reduce((sum, count) => sum + count, 0));
  expect(m.rsvp[rsvpStatus]).toBe(3);
  expect(m.currentSlots).toBe(items.filter(item => !item.isArchived).reduce((sum, item) => sum + item.guests.length, 0));
  expect(m.currentSlots).toBe(m.identifiedPeople + m.unassignedSpaces);
 });
 it.each([false, null, true] as const)('open anónimo %s no es persona, respuesta ni seguimiento', attending => {
  const metrics = calculateDashboardMetrics([invitation('A', { guests: [guest('  ', attending, 'open')] })]);
  expect(metrics).toMatchObject({ currentSlots: 1, unassignedSpaces: 1, identifiedPeople: 0, attending: 0, notAttending: 0, unanswered: 0, responded: 0, responseRate: null, invitationsWithUnanswered: 0 });
 });
 it.each(['known', 'open', 'replacement'] as const)('cuenta personas identificadas %s según su respuesta', type => {
  const metrics = calculateDashboardMetrics([invitation('A', { maxGuests: 3, guests: [guest('Sí', true, type), guest('No', false, type), guest('Pendiente', null, type)] })]);
  expect(metrics).toMatchObject({ identifiedPeople: 3, attending: 1, notAttending: 1, unanswered: 1, responded: 2, invitationsWithUnanswered: 1, currentReplacements: type === 'replacement' ? 3 : 0 });
  expect(metrics.responseRate).toBeCloseTo(200 / 3);
 });
 it('separa capacidad y personas y cuenta la sustitución actual una sola vez', () => {
  const metrics = calculateDashboardMetrics([invitation('A', { maxGuests: 4, guests: [guest('Sustituto', true, 'replacement'), guest('Otra persona', null), guest('', false, 'open'), guest('', null, 'open')] })]);
  expect(metrics).toMatchObject({ currentSlots: 4, identifiedPeople: 2, attending: 1, notAttending: 0, unanswered: 1, unassignedSpaces: 2, currentReplacements: 1, responded: 1, responseRate: 50 });
 });
 it('excluye archivadas de personas, capacidad, seguimiento y distribución', () => {
  const metrics = calculateDashboardMetrics([invitation('A'), invitation('B', { isArchived: true, rsvpStatus: 'confirmed', maxGuests: 2, guests: [guest('Archivada', true), guest('Pendiente archivada')] })]);
  expect(metrics).toMatchObject({ registeredInvitations: 2, activeInvitations: 1, archivedInvitations: 1, currentSlots: 1, attending: 0, identifiedPeople: 1, unanswered: 1, invitationsWithUnanswered: 1, rsvp: { pending: 1, partial: 0, confirmed: 0, declined: 0 } });
 });
 it('usa los cuatro estados reales; partial no se interpreta como seguimiento', () => {
  const metrics = calculateDashboardMetrics(['pending', 'partial', 'confirmed', 'declined'].map((status, index) => invitation(String(index), { rsvpStatus: status as 'pending' | 'partial' | 'confirmed' | 'declined', guests: [guest('Respondió', true)] })));
  expect(metrics.rsvp).toEqual({ pending: 1, partial: 1, confirmed: 1, declined: 1 });
  expect(metrics.invitationsWithUnanswered).toBe(0);
  expect(metrics.responseRate).toBe(100);
 });
 it('sin registros o con solo archivadas no calcula porcentaje', () => {
  expect(calculateDashboardMetrics([])).toMatchObject({ registeredInvitations: 0, responseRate: null, currentSlots: 0 });
  expect(calculateDashboardMetrics([invitation('A', { isArchived: true })])).toMatchObject({ activeInvitations: 0, responseRate: null });
 });
});

describe('selecciones del Dashboard', () => {
 it('conserva registros homónimos distintos y no añade originalName como otra persona', () => {
  const items = [invitation('B', { displayName: 'Igual', guests: [guest('Alex', null, 'replacement')] }), invitation('A', { displayName: 'Igual', maxGuests: 2, guests: [guest('Alex'), guest('Alex', null, 'open')] })];
  const result = buildDashboardDetails(items).unanswered;
  expect(result.map(person => [person.invitationId, person.index, person.name])).toEqual([['A', 0, 'Alex'], ['A', 1, 'Alex'], ['B', 0, 'Alex']]);
  expect(new Set(result.map(person => `${person.invitationId}:${person.index}`)).size).toBe(3);
  expect(calculateDashboardMetrics(items).identifiedPeople).toBe(3);
 });
 it('desempata actualizaciones con igual nombre y fecha por ID, independientemente del orden de entrada', () => {
  const items = ['C', 'B', 'A'].map(id => invitation(id, { displayName: 'Igual', updatedAt: '2026-09-22T12:00:00Z' }));
  expect(buildDashboardDetails(items).recent.map(item => item.id)).toEqual(['A', 'B', 'C']);
  expect(buildDashboardDetails([...items].reverse()).recent.map(item => item.id)).toEqual(['A', 'B', 'C']);
 });
 it('barras: cinco mayores capacidades, desempate por nombre e ID, sin mutar la entrada', () => {
  const items = [invitation('Z', { maxGuests: 8 }), invitation('B', { displayName: 'Igual', maxGuests: 4 }), invitation('A', { displayName: 'Igual', maxGuests: 4 }), ...[1, 2, 3, 4, 5].map(n => invitation(`N${n}`, { maxGuests: n })), invitation('ARCH', { isArchived: true, maxGuests: 100 })];
  const snapshot = structuredClone(items);
  expect(buildDashboardDetails(items).capacity.map(item => item.id)).toEqual(['Z', 'N5', 'N4', 'A', 'B']);
  expect(items).toEqual(snapshot);
  expect(calculateDashboardMetrics(items).activeInvitations).toBe(8);
 });
 it('personas: orden por invitación y posición, sin anónimos, respondidos ni archivadas', () => {
  const items = [invitation('B'), invitation('A', { guests: [guest('', null, 'open'), guest('Respondida', false), guest('Reemplazo', null, 'replacement'), guest('Acompañante con nombre', null, 'open')] }), invitation('ARCH', { isArchived: true })];
  expect(buildDashboardDetails(items).unanswered.map(person => [person.name, person.invitationId, person.index])).toEqual([['Reemplazo', 'A', 2], ['Acompañante con nombre', 'A', 3], ['Persona B', 'B', 0]]);
 });
 it('selecciones acotadas no recortan las métricas globales', () => {
  const items = Array.from({ length: 12 }, (_, n) => invitation(String(n)));
  expect(buildDashboardDetails(items).unanswered).toHaveLength(5);
  expect(calculateDashboardMetrics(items)).toMatchObject({ unanswered: 12, invitationsWithUnanswered: 12 });
 });
 it('actualizaciones: orden cronológico real, solo fechas válidas de activas y cinco resultados', () => {
  const items = Array.from({ length: 7 }, (_, n) => invitation(String(n), { updatedAt: `2026-09-${10 + n}T12:00:00Z` }));
  items.push(invitation('null'), invitation('invalid', { updatedAt: 'inválida' }), invitation('archived', { isArchived: true, updatedAt: '2027-01-01T00:00:00Z' }));
  const result = buildDashboardDetails(items);
  expect(result.recent.map(item => item.id)).toEqual(['6', '5', '4', '3', '2']);
  expect(result.datedInvitations).toBe(7);
 });
 it('empates temporales estables y colecciones vacías', () => {
  expect(buildDashboardDetails([invitation('B', { updatedAt: '2026-09-01T10:00:00-05:00' }), invitation('A', { updatedAt: '2026-09-01T15:00:00Z' })]).recent.map(item => item.id)).toEqual(['A', 'B']);
  expect(buildDashboardDetails([])).toEqual({ capacity: [], unanswered: [], recent: [], datedInvitations: 0 });
 });
});
