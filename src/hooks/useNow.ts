import { useEffect, useState } from 'react';

/** performance.now(), re-rendered every `intervalMs` while `active`. */
export function useNow(active: boolean, intervalMs = 100) {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    if (!active) return;
    setNow(performance.now());
    const id = setInterval(() => setNow(performance.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}
