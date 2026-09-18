import { readWorkbook } from './readWorkbook';
import { validateWorkbook } from '../model/validateWorkbook';
import type { WorkerResult } from '../model/import.types';

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  let result: WorkerResult;
  try {
    result = { ok: true, analysis: validateWorkbook(readWorkbook(event.data)) };
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : 'No se pudo leer el archivo XLSX.' };
  }
  self.postMessage(result);
};
