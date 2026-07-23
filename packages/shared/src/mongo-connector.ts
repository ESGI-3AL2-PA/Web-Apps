// Infrastructure partagée (couche « connecteur base de données »). Expose une
// fabrique de connecteur Mongo mutualisée par les deux backends.
import { MongoClient, type Db } from "mongodb";

export interface MongoConnector {
  /** Se connecte (idempotent — le driver mutualise) et renvoie le handle de la base applicative. */
  connectDB: () => Promise<Db>;
  /** Le client sous-jacent, exposé pour que le helper de transaction puisse ouvrir des sessions (écritures multi-documents). */
  getMongoClient: () => MongoClient;
  /**
   * Contrôle de disponibilité : aller-retour peu coûteux vers le serveur. Rejette
   * si la connexion est morte (serveur arrêté, auth révoquée, partition réseau)
   * afin que /readyz puisse renvoyer 503.
   */
  pingDB: () => Promise<void>;
  closeDB: () => Promise<void>;
}

/**
 * Construit un connecteur Mongo lié à un unique client partagé. Les deux backends
 * maintenaient un connecteur byte-à-byte identique ; ceci en est la source unique
 * de vérité. Les valeurs par défaut viennent des mêmes variables d'env que les
 * apps utilisaient (lues une seule fois, à la construction).
 */
export const createMongoConnector = (
  url: string = process.env.MONGODB_URL ?? "mongodb://root:root@localhost:27017",
  dbName: string = process.env.MONGODB_DB ?? "db",
): MongoConnector => {
  const client = new MongoClient(url);

  return {
    connectDB: async () => {
      await client.connect();
      return client.db(dbName);
    },
    getMongoClient: () => client,
    pingDB: async () => {
      await client.db(dbName).command({ ping: 1 });
    },
    closeDB: async () => {
      await client.close();
    },
  };
};
