import type {
  ContractQueryDto,
  ContractResponseDto,
  ContractResponseDtoSchema,
  CreateContractDto,
  DisputeContractDto,
  PaginatedResponseDto,
  SignContractDto,
} from "@repo/contracts";
import api from "./api";

type PaginatedContracts = PaginatedResponseDto<typeof ContractResponseDtoSchema>;

// GET /contracts — paginated list with optional filters
// (listingId, providerId, beneficiaryId, openSignStatus, disputed, page, limit)
export async function getContracts(
  filters: ContractQueryDto = {} as ContractQueryDto,
): Promise<PaginatedContracts> {
  try {
    const res = await api.get<PaginatedContracts>("/contracts", { params: filters });
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors du get all contracts");
  }
}

// GET /contracts/:id — single contract
export async function getContractById(id: string): Promise<ContractResponseDto> {
  try {
    const res = await api.get<ContractResponseDto>(`/contracts/${id}`);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Contrat introuvable");
  }
}

// POST /contracts — generate a new contract (typically from a paid listing acceptance)
export async function createContract(data: CreateContractDto): Promise<ContractResponseDto> {
  try {
    const res = await api.post<ContractResponseDto>("/contracts", data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la création du contrat");
  }
}

// POST /contracts/:id/sign — OpenSign callback (updates openSignDocumentId + status)
export async function signContract(id: string, data: SignContractDto): Promise<ContractResponseDto> {
  try {
    const res = await api.post<ContractResponseDto>(`/contracts/${id}/sign`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de la signature du contrat");
  }
}

// POST /contracts/:id/dispute — flag the contract as disputed
export async function disputeContract(
  id: string,
  data: DisputeContractDto,
): Promise<ContractResponseDto> {
  try {
    const res = await api.post<ContractResponseDto>(`/contracts/${id}/dispute`, data);
    if (!res.data) {
      throw new Error();
    }
    return res.data;
  } catch {
    throw new Error("Erreur lors de l'ouverture du litige");
  }
}

// DELETE /contracts/:id
export async function deleteContract(id: string): Promise<void> {
  try {
    await api.delete(`/contracts/${id}`);
  } catch {
    throw new Error("Erreur lors de la suppression du contrat");
  }
}
