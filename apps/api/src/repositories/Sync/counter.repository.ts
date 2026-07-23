/** Contrat du repository de compteurs (séquences atomiques nommées). */
export interface ICounterRepository {
  /**
   * Distribue la valeur suivante d'un compteur nommé. Un `$inc` sur un unique
   * document est atomique dans Mongo sans transaction, donc sûr en concurrence.
   */
  next(name: string): Promise<number>;
}
