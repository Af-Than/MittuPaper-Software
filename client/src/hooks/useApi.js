import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../api/client';

/**
 * Run an async loader on mount and whenever `deps` change.
 * Keeps the previous data visible while reloading (no flicker); ignores stale responses.
 * Pass `enabled: false` to skip loading.
 */
export function useApi(loader, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const counter = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(() => {
    const my = ++counter.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return loaderRef.current()
      .then((data) => {
        if (my === counter.current) setState({ data, loading: false, error: null });
        return data;
      })
      .catch((err) => {
        if (my === counter.current) setState((s) => ({ ...s, loading: false, error: errorMessage(err) }));
      });
  }, []);

  useEffect(() => {
    if (enabled) run();
    else setState({ data: null, loading: false, error: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { ...state, reload: run, setData: (data) => setState((s) => ({ ...s, data })) };
}

export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}
