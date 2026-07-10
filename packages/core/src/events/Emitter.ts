export type Handler<T> = (payload: T) => void;

/** Minimal typed event emitter. Zero dependencies. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(fn as Handler<never>);
    return () => this.off(event, fn);
  }

  once<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
    const off = this.on(event, (p) => {
      off();
      fn(p);
    });
    return off;
  }

  off<K extends keyof Events>(event: K, fn: Handler<Events[K]>): void {
    this.handlers.get(event)?.delete(fn as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.handlers.get(event)?.forEach((fn) => (fn as Handler<Events[K]>)(payload));
  }

  removeAll(): void {
    this.handlers.clear();
  }
}
