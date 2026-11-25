/** @param {(work: () => Promise<void>) => void} schedule
 * @param {() => Promise<unknown>} notify
 * @param {() => void} onError
 */
export function scheduleNotification(schedule, notify, onError = () => {}) {
  try {
    schedule(async () => {
      try {
        await notify();
      } catch {
        onError();
      }
    });
  } catch {
    onError();
  }
}
