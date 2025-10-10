const listeners = {};

export function on(event, cb) {
  if (!listeners[event]) listeners[event] = new Set();
  listeners[event].add(cb);
  return () => {
    listeners[event]?.delete(cb);
    if (listeners[event]?.size === 0) delete listeners[event];
  };
}

export function emit(event, payload) {
  const set = listeners[event];
  if (!set) return;
  set.forEach((cb) => {
    try { cb(payload); } catch { /* no-op */ }
  });
}
