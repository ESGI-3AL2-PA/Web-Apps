/**
 * Petit service-locator typé et minimal. Les deux backends réimplémentaient à la main
 * le même trio singleton-nullable + `resolve<K>` + garde « non initialisé » ; ce
 * générique factorise cette forme une seule fois. Chaque app fournit sa propre factory
 * qui construit l'objet conteneur concret et appelle `set(...)` (en général au sein d'un
 * `initContainer(...)` qui réalise aussi le câblage spécifique à l'app, comme la création
 * des index Mongo).
 */
export interface Container<T extends object> {
  /** Stocke le conteneur construit. À appeler une seule fois, au démarrage. */
  set: (instance: T) => void;
  /** Résout une dépendance par sa clé. Lève si le conteneur n'a pas été initialisé. */
  resolve: <K extends keyof T>(key: K) => T[K];
}

export const createContainer = <T extends object>(): Container<T> => {
  let instance: T | null = null;

  return {
    set: (built: T) => {
      instance = built;
    },
    resolve: <K extends keyof T>(key: K): T[K] => {
      // Garde : résoudre avant initialisation est un bug de câblage au démarrage, pas un cas nominal.
      if (!instance) throw new Error("Container not initialized — call initContainer() first");
      return instance[key];
    },
  };
};
