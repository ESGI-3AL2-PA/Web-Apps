/**
 * Types de transport (« wire types ») du protocole du worker. Le worker exécute
 * la requête contre Mongo et renvoie le résultat, donc le côté Node ignore tout
 * de Mongo — le descripteur d'opération / les formes du driver vivent entièrement
 * en Python.
 */

/** Forme brute émise par worker.py sur stdout (ndjson). `result` est ce qu'a
 *  renvoyé la requête exécutée (documents / compteurs du driver). */
export interface SatanResponse {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
  trace?: string;
}

/**
 * Levée par SatanClient.query() quand le worker répond ok=false. Conserve la
 * stack Python d'origine sous .pythonTrace pour le débogage.
 */
export class SatanQueryError extends Error {
  public readonly pythonTrace?: string;

  constructor(message: string, pythonTrace?: string) {
    super(message);
    this.name = "SatanQueryError";
    this.pythonTrace = pythonTrace;
  }
}
