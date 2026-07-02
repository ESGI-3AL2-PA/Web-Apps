// Shape returned by every paginated api list endpoint (mirrors PaginatedResponseDtoSchema).
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Common query params accepted by list endpoints. Domain-specific filters extend this.
export interface ListParams {
  page?: number;
  limit?: number;
  search?: string;
  [key: string]: string | number | boolean | undefined;
}
