// Simple ré-export conservé pour compatibilité ascendante : l'implémentation de
// référence vit dans ./jwtExpiry. Préférer un import direct depuis "@repo/hooks",
// qui ré-expose la surface publique.
export { getJwtExpiry, isTokenExpiringSoon } from "./jwtExpiry";
