/**
 * Point d'entrée zod partagé pour les contracts.
 *
 * Étend l'instance zod avec les helpers OpenAPI (`.openapi()`) puis la
 * ré-exporte : tous les DTO/contracts doivent importer `z` d'ici plutôt que
 * de `zod` directement, sinon `extendZodWithOpenApi` n'est pas appliqué et les
 * métadonnées OpenAPI sont perdues.
 */
import { z } from "zod";
import { extendZodWithOpenApi } from "@anatine/zod-openapi";

extendZodWithOpenApi(z);

export { z };
