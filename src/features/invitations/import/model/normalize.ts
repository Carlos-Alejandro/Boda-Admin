import type { ImportCell } from './import.types';

export const textValue = (cell?: ImportCell): string | null =>
  !cell?.formula && cell?.type !== 'e' && typeof cell?.value === 'string'
    ? cell.value.trim() || null : null;

export function openSlotsValue(cell?: ImportCell): number | null {
  if (!cell || cell.formula || cell.type === 'e' || cell.type === 'd' || cell.value instanceof Date) return null;
  const value = cell.value;
  const parsed = typeof value === 'number' ? value
    : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function replacementsValue(cell?: ImportCell): boolean | null {
  if (!cell || cell.formula || cell.type === 'e') return null;
  if (typeof cell.value === 'boolean') return cell.value;
  const value = textValue(cell)?.toLowerCase();
  if (value === 'sí' || value === 'si') return true;
  return value === 'no' ? false : null;
}

export const hasContent = (cell: ImportCell) => Boolean(cell.formula) || cell.type === 'e'
  || (cell.value !== null && cell.value !== undefined
    && (typeof cell.value !== 'string' || cell.value.trim() !== ''));
