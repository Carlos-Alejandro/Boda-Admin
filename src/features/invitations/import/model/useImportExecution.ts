import { useEffect, useRef, useState } from 'react';
import type { ImportAnalysis } from './import.types';
import { canImport, executeImport, prepareImport, type ImportItem } from './importExecution';

type Phase = 'idle' | 'confirming' | 'running' | 'finished';
export function useImportExecution(analysis: ImportAnalysis | null) {
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const [items, setItems] = useState<ImportItem[]>([]);
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => { controller.current?.abort(); }, []);
  const changePhase = (next: Phase) => { phaseRef.current = next; setPhase(next); };
  const open = () => {
    if (phaseRef.current !== 'idle' || !canImport(analysis)) return;
    changePhase('confirming');
  };
  const cancel = () => {
    if (phaseRef.current === 'confirming') changePhase('idle');
  };
  const reset = () => {
    if (phaseRef.current === 'running' || phaseRef.current === 'confirming') return false;
    setItems([]); setError(undefined); changePhase('idle'); return true;
  };
  const confirm = async () => {
    if (phaseRef.current !== 'confirming' || !canImport(analysis)) return;
    changePhase('running');
    const active = new AbortController();
    controller.current = active;
    try {
      const prepared = prepareImport(analysis);
      setItems(prepared);
      await executeImport(prepared, active.signal, setItems);
    } catch {
      if (!active.signal.aborted) setError('No se pudo preparar la importación. No se enviaron invitaciones.');
    } finally {
      if (!active.signal.aborted) changePhase('finished');
    }
  };
  return { phase, items, error, open, cancel, confirm, reset, eligible: phase === 'idle' && canImport(analysis) };
}
