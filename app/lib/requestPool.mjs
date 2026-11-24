// Share only requests that are still in flight. Never cache account responses.
const pending = new Map();
/** @template T @param {string} key @param {() => Promise<T>} request @returns {Promise<T>} */
export function sharedRequest(key, request) {
  const existing = pending.get(key);
  if (existing) return existing;
  const result = Promise.resolve()
    .then(request)
    .finally(() => {
      if (pending.get(key) === result) pending.delete(key);
    });
  pending.set(key, result);
  return result;
}
