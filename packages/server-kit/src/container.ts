/**
 * Minimal typed service-locator harness. Both backends hand-rolled the same
 * nullable-singleton + `resolve<K>` + "not initialized" guard; this generic keeps
 * that shape once. Each app supplies its own factory that builds the concrete
 * container object and calls `set(...)` (usually inside an `initContainer(...)`
 * that also does app-specific wiring like index creation).
 */
export interface Container<T extends object> {
  /** Store the built container. Call once, at startup. */
  set: (instance: T) => void;
  /** Resolve a dependency by key. Throws if the container hasn't been initialized. */
  resolve: <K extends keyof T>(key: K) => T[K];
}

export const createContainer = <T extends object>(): Container<T> => {
  let instance: T | null = null;

  return {
    set: (built: T) => {
      instance = built;
    },
    resolve: <K extends keyof T>(key: K): T[K] => {
      if (!instance) throw new Error("Container not initialized — call initContainer() first");
      return instance[key];
    },
  };
};
