export interface ICounterRepository {
  /**
   * Hand out the next value of a named counter. A single-document `$inc` is atomic
   * in Mongo without a transaction, so this is safe under concurrency.
   */
  next(name: string): Promise<number>;
}
