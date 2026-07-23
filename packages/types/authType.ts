/**
 * Types partagés décrivant la forme des formulaires d'authentification côté front
 * (formulaires de connexion et d'inscription).
 */

/** Champs saisis dans le formulaire de connexion. */
export interface LoginFormI {
  email: string;
  password: string;
}

/** Champs saisis dans le formulaire d'inscription. */
export interface RegisterFormI {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  // Le quartier n'est pas encore collecté ici : à ajouter via un select dédié.
}
