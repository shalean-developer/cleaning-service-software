/** Schedules work after the current effect flush — avoids synchronous setState in effects. */
export function deferEffectWork(work: () => void): void {
  queueMicrotask(work);
}
