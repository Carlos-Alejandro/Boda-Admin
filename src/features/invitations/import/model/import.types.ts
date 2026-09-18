import type { CreateInvitationInput } from '../../model/invitation.types';

export interface ImportIssue {
  severity: 'error' | 'warning';
  sheet: string;
  row: number;
  column: string;
  code: string;
  message: string;
}

export interface ImportCell {
  column: number;
  value: unknown;
  formula?: boolean;
  type?: string;
}
export interface ImportRow { row: number; cells: ImportCell[] }
export interface ImportSheet {
  name: string;
  rows: ImportRow[];
  mergedCells: Array<{ row: number; column: number }>;
}
export interface ImportWorkbook { sheets: ImportSheet[] }

export interface InvitationPreview {
  row: number;
  displayName: string | null;
  knownGuests: Array<{ name: string; row: number; column: number }>;
  openSlots: number | null;
  replacementsAllowed: boolean | null;
  valid: boolean;
  input: CreateInvitationInput | null;
}

export interface ImportAnalysis {
  valid: boolean;
  invitations: InvitationPreview[];
  issues: ImportIssue[];
  summary: {
    invitations: number;
    identifiedPeople: string;
    openSlots: string;
    totalSlots: string;
    validInvitations: number;
    invalidInvitations: number;
    errors: number;
    warnings: number;
  };
}

export type WorkerResult = { ok: true; analysis: ImportAnalysis } | { ok: false; message: string };
