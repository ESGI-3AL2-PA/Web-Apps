import type {
  PaginatedResponseDto,
  UpdateUserDto,
  UserQueryDto,
  UserResponseDto,
  UserResponseDtoSchema,
} from "@repo/contracts";
import api from "./api";

type PaginatedUsers = PaginatedResponseDto<typeof UserResponseDtoSchema>;

// Consigne ADMIN — USERS:
//   - Read all (voir tous les utilisateurs du quartier)
//   - Update (modifier rôle ou statut)
//   - Delete (modération)

// GET /users — paginated list (filters: search, role, status, districtId, …)
export async function getUsers(filters: UserQueryDto = {} as UserQueryDto): Promise<PaginatedUsers> {
  try {
    const res = await api.get<PaginatedUsers>("/users", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all users");
  }
}

// GET /users/:id — fetch a specific user (admin can read anyone)
export async function getUserById(id: string): Promise<UserResponseDto> {
  try {
    const res = await api.get<UserResponseDto>(`/users/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Utilisateur introuvable");
  }
}

// PATCH /users/:id — modify role / status / profile fields
export async function updateUser(id: string, data: UpdateUserDto): Promise<UserResponseDto> {
  try {
    const res = await api.patch<UserResponseDto>(`/users/${id}`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la mise à jour de l'utilisateur");
  }
}

// DELETE /users/:id — modération (RGPD cascade côté backend)
export async function deleteUser(id: string): Promise<void> {
  try {
    await api.delete(`/users/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression de l'utilisateur");
  }
}
