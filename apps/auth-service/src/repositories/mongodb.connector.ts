// Connecteur Mongo de l'auth-service (couche repository, infrastructure).
// Expose un unique client partagé par toute l'application et réexporte les
// fonctions de cycle de vie de la connexion que le reste du code importe.
import { createMongoConnector } from "@repo/shared";

// Un seul client partagé pour toute l'application. La logique du connecteur vit
// dans @repo/shared ; ici on la lie à l'environnement de l'auth-service et on
// réexporte les fonctions consommées par l'application.
const connector = createMongoConnector();

export const connectDB = connector.connectDB;
export const pingDB = connector.pingDB;
export const closeDB = connector.closeDB;
