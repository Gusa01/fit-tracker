import { useCallback, useRef, useState } from 'react';
import { useToast } from '../components/ui';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

// The routine editor saves each change on its own, with no save button, so this tracks those saves to tell the
// user they landed (or didn't) and lets "Listo" wait for the ones still in flight.
export function useSaveTracker() {
  const toast = useToast();
  const [status, setStatus] = useState<SaveStatus>('idle');
  const pending = useRef(new Set<Promise<unknown>>());
  const failed = useRef(false);

  const track = useCallback(
    async (save: Promise<unknown>): Promise<boolean> => {
      if (pending.current.size === 0) failed.current = false;
      pending.current.add(save);
      setStatus('saving');
      try {
        await save;
        return true;
      } catch {
        failed.current = true;
        toast('No se pudo guardar el cambio. Revisá la conexión.', 'error');
        return false;
      } finally {
        pending.current.delete(save);
        if (pending.current.size === 0) setStatus(failed.current ? 'error' : 'saved');
      }
    },
    [toast]
  );

  // Resolves once every save started so far has finished, with whether they all succeeded.
  const settle = useCallback(async () => {
    await Promise.allSettled([...pending.current]);
    return !failed.current;
  }, []);

  return { status, track, settle };
}
