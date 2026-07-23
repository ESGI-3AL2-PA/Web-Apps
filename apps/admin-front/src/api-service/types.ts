// Types partagés par toute la couche api-service : forme des réponses paginées et des query params de liste.

/** Forme renvoyée par chaque endpoint de liste paginé de l'api (miroir de PaginatedResponseDtoSchema). */
export interface Paginated<T> {
  data: T[];
  total: number; // nombre total d'éléments (toutes pages confondues)
  page: number; // page courante (1-indexée)
  limit: number; // taille de page
}

/** Query params communs aux endpoints de liste. La signature d'index permet des filtres spécifiques au domaine. */
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}
