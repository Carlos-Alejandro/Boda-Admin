import { useEffect, useRef, useState } from 'react';
import type { ImportAnalysis } from './import.types';
import { canImport } from './importExecution';
import { ImportSessionChangedError, ImportSessionError, ImportStorageError, recoverSession, type ImportSession } from './importSession';
import { removeImportSession, resumeImportSession, startImportSession } from './importSessionController';
import { importSessionStore, STORAGE_ERROR } from '../storage/importSessionStore';

type Phase = 'loading' | 'idle' | 'confirming' | 'running' | 'finished';
export function useImportExecution(analysis: ImportAnalysis | null, filename = '') {
  const [phase, setPhase] = useState<Phase>('loading');
  const phaseRef = useRef<Phase>('loading');
  const [session, setSession] = useState<ImportSession | null>(null);
  const sessionRef = useRef<ImportSession | null>(null);
  const [error, setError] = useState<string>();
  const [reconciling, setReconciling] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const blocked = useRef(false);
  const unsaved = useRef(false);
  const mounted = useRef(false);
  const operation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  // Require a newly selected file after discarding/closing; never reuse an old preview.
  const consumed = useRef(false);
  const [previewConsumed, setPreviewConsumed] = useState(false);
  const markConsumed = (value: boolean) => { consumed.current = value; if (mounted.current) setPreviewConsumed(value); };
  const changePhase = (next: Phase) => { phaseRef.current = next; if (mounted.current) setPhase(next); };
  const showSession = (next: ImportSession | null) => {
    if (mounted.current) setReconciling(!!next?.items.some((item, index) => item.status === 'creating' && sessionRef.current?.items[index]?.status === 'unknown'));
    sessionRef.current = next;
    if (mounted.current) setSession(next);
    if (next) markConsumed(true);
  };
  const report = (failure: unknown) => {
    blocked.current = true;
    const storageFailure = failure instanceof ImportStorageError || !(failure instanceof ImportSessionError);
    if (sessionRef.current && storageFailure) unsaved.current = true;
    if (mounted.current) {
      setStorageBlocked(storageFailure || unsaved.current);
      setError(failure instanceof ImportSessionError ? failure.message : STORAGE_ERROR);
    }
  };
  const refresh = async () => {
    if (phaseRef.current === 'running' || phaseRef.current === 'confirming') return;
    const generation = ++operation.current;
    changePhase('loading');
    try {
      const stored = await importSessionStore.load();
      if (!mounted.current || operation.current !== generation) return;
      // Do not discard better in-memory evidence after a failed commit.
      if (sessionRef.current && unsaved.current) return;
      showSession(stored ? recoverSession(stored) : null);
      blocked.current = false; setStorageBlocked(false); setError(undefined);
    } catch (failure) { if (mounted.current && operation.current === generation) report(failure); }
    finally {
      if (mounted.current && operation.current === generation) changePhase(sessionRef.current ? 'finished' : 'idle');
    }
  };
  const stop = () => { mounted.current = false; operation.current++; controller.current?.abort(); };
  useEffect(() => {
    mounted.current = true;
    queueMicrotask(() => { if (mounted.current) void refresh(); });
    return stop;
    // The initial read is independent of preview renders; mutations reload under a lock.
  }, []);
  const open = () => {
    if (phaseRef.current !== 'idle' || blocked.current || sessionRef.current || consumed.current || !canImport(analysis)) return;
    changePhase('confirming');
  };
  const cancel = () => { if (phaseRef.current === 'confirming') changePhase('idle'); };
  const reset = () => {
    if (phaseRef.current !== 'idle' || blocked.current || sessionRef.current) return false;
    markConsumed(false); setError(undefined); return true;
  };
  const execute = async (resume: boolean) => {
    if (!mounted.current || phaseRef.current === 'running' || phaseRef.current === 'loading') return;
    if (resume ? !sessionRef.current : phaseRef.current !== 'confirming' || !canImport(analysis) || !!sessionRef.current) return;
    changePhase('running'); markConsumed(true); ++operation.current;
    setError(undefined);
    const active = new AbortController(); controller.current = active;
    try {
      const onChange = (next: ImportSession) => { if (mounted.current) showSession(next); };
      if (resume) await resumeImportSession(sessionRef.current!.id, active.signal, onChange, undefined, sessionRef.current!);
      else await startImportSession(analysis!, filename, active.signal, onChange);
      if (mounted.current) { blocked.current = false; unsaved.current = false; setStorageBlocked(false); }
    } catch (failure) { if (mounted.current) report(failure); }
    finally { if (mounted.current) changePhase(sessionRef.current ? 'finished' : 'idle'); }
  };
  const remove = async (completedOnly: boolean, expected = sessionRef.current) => {
    if (!mounted.current || phaseRef.current === 'running' || phaseRef.current === 'loading' || !sessionRef.current) return;
    if (!expected) return;
    changePhase('running'); ++operation.current;
    try {
      await removeImportSession(expected.id, completedOnly, undefined, expected);
      if (mounted.current) { showSession(null); setError(undefined); blocked.current = false; unsaved.current = false; setStorageBlocked(false); }
    } catch (failure) {
      if (mounted.current) {
        if (failure instanceof ImportSessionChangedError) showSession(failure.session);
        report(failure);
      }
    }
    finally { if (mounted.current) changePhase(sessionRef.current ? 'finished' : 'idle'); }
  };
  return { phase, session, items: session?.items ?? [], error, storageBlocked, reconciling, open, cancel,
    confirm: () => execute(false), resume: () => execute(true), remove, refresh, reset,
    fileBlocked: phase !== 'idle' || storageBlocked || !!session,
    eligible: phase === 'idle' && !storageBlocked && !session && !previewConsumed && canImport(analysis) };
}
