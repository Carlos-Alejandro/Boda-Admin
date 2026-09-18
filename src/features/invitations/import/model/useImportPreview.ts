import { useEffect, useRef, useState } from 'react';
import { MAX_FILE_BYTES, READ_TIMEOUT_MS } from '../excel/technicalLimits';
import type { ImportAnalysis, WorkerResult } from './import.types';

type State = { status: 'empty' } | { status: 'reading'; filename: string }
  | { status: 'valid' | 'invalid'; filename: string; analysis: ImportAnalysis }
  | { status: 'read-error'; filename: string; message: string };

export function useImportPreview() {
  const [state, setState] = useState<State>({ status: 'empty' });
  const generation = useRef(0);
  const active = useRef<{ worker: Worker; timeout: number } | null>(null);
  const stop = () => {
    if (active.current) {
      active.current.worker.terminate();
      window.clearTimeout(active.current.timeout);
      active.current = null;
    }
  };
  useEffect(() => () => { generation.current++; stop(); }, []);

  const selectFile = async (file: File) => {
    const current = ++generation.current;
    stop();
    setState({ status: 'reading', filename: file.name });
    const fail = (message: string) => {
      if (current !== generation.current) return;
      stop();
      setState({ status: 'read-error', filename: file.name, message });
    };
    if (!/\.xlsx$/i.test(file.name)) { fail('Selecciona un archivo con extensión .xlsx.'); return; }
    if (file.size > MAX_FILE_BYTES) { fail('El archivo supera la protección técnica de 25 MiB. Divide el archivo y vuelve a seleccionarlo.'); return; }
    try {
      const worker = new Worker(new URL('../excel/import.worker.ts', import.meta.url), { type: 'module' });
      active.current = { worker, timeout: window.setTimeout(() => fail('La lectura superó 30 segundos. Revisa o divide el archivo y vuelve a intentarlo.'), READ_TIMEOUT_MS) };
      worker.onerror = () => fail('No se pudo iniciar o completar la lectura local. Vuelve a seleccionar el archivo.');
      worker.onmessageerror = () => fail('No se pudo recuperar el análisis del archivo.');
      worker.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
        if (current !== generation.current || active.current?.worker !== worker) return;
        if (!data.ok) { fail(data.message); return; }
        stop();
        setState({ status: data.analysis.valid ? 'valid' : 'invalid', filename: file.name, analysis: data.analysis });
      };
      const data = await file.arrayBuffer();
      if (current === generation.current && active.current?.worker === worker) worker.postMessage(data, [data]);
    } catch { fail('No se pudo abrir el archivo. Selecciona un XLSX válido e inténtalo de nuevo.'); }
  };
  return { state, selectFile };
}
