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

/**
 * Télécharge le PDF d'un contract et l'ouvre dans un nouvel onglet.
 * On passe par axios pour que le Bearer soit attaché automatiquement (un
 * `window.open` direct sur l'URL n'inclurait pas l'en-tête Authorization).
 */
export async function viewContractPdf(contractId: string): Promise<void> {
  try {
    const res = await api.get(`/contracts/${contractId}/pdf`, { responseType: "blob" });
    const blob = new Blob([res.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Libère la mémoire au bout de quelques secondes (le tab a déjà chargé).
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    throw new Error("Impossible d'ouvrir le PDF du contrat");
  }
}

/**
 * Variante "blob brut" — utile pour afficher le PDF DANS la page (iframe)
 * plutôt que dans un nouvel onglet. Le composant doit gérer le `URL.revokeObjectURL`
 * dans son cleanup useEffect.
 */
export async function fetchContractPdfBlob(contractId: string): Promise<Blob> {
  try {
    const res = await api.get(`/contracts/${contractId}/pdf`, { responseType: "blob" });
    return new Blob([res.data], { type: "application/pdf" });
  } catch {
    throw new Error("Impossible de charger le PDF du contrat");
  }
}

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

// POST /contracts/:id/sign — embed la signature de l'utilisateur dans le PDF.
// `signatureImage` est un data-URL PNG produit par le canvas du SignaturePad.
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
