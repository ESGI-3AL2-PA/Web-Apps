import { createMongoConnector } from "@repo/shared";

// Connecteur Mongo de l'api (couche infrastructure). Un seul client partagé pour
// toute l'application. La logique de connexion vit dans @repo/shared ; ce fichier
// la lie à l'environnement de l'api et réexporte les fonctions que l'app importe.
const connector = createMongoConnector();

export const connectDB = connector.connectDB;
// Exposé pour que le helper de transactions puisse ouvrir des sessions (écritures multi-documents).
export const getMongoClient = connector.getMongoClient;
export const pingDB = connector.pingDB;
export const closeDB = connector.closeDB;
