// Wrappers d'appels HTTP vers les endpoints /contracts de l'api (contrats de signature).
import type { ContractResponseDto, ResolveDisputeDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

/** Liste paginee des contrats. */
export async function listContracts(params: ListParams): Promise<Paginated<ContractResponseDto>> {
  const res = await api.get<Paginated<ContractResponseDto>>("/contracts", { params });
  return res.data;
}

/** Tranche un litige sur un contrat donne (action reservee a l'admin). */
export async function resolveDispute(id: string, body: ResolveDisputeDto): Promise<ContractResponseDto> {
  const res = await api.post<ContractResponseDto>(`/contracts/${id}/resolve-dispute`, body);
  return res.data;
}
