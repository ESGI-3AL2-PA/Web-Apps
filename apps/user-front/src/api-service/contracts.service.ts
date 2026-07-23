/**
 * Service client des contrats de signature électronique (couche e-signature au-dessus
 * d'une annonce « prise »). L'api est l'unique passerelle vers Documenso : le front ne
 * parle jamais directement à Documenso ni à S3. Chaque fonction encapsule un appel REST
 * et renvoie les données typées par les DTO des contracts.
 */
import type { ContractQueryDto, ContractResponseDto, CreateContractDto, DisputeContractDto } from "@repo/contracts";
import api from "./api";

/** Enveloppe paginée renvoyée par la liste des contrats. */
export interface PaginatedContracts {
  data: ContractResponseDto[];
  total: number;
  page: number;
  limit: number;
}

/** GET /contracts — les contrats de l'appelant (paginé, filtres optionnels). */
export async function getContracts(filters: Partial<ContractQueryDto> = {}): Promise<PaginatedContracts> {
  const res = await api.get<PaginatedContracts>("/contracts", { params: filters });
  return res.data;
}

/** GET /contracts/:id — un contrat unique (partie prenante ou admin). */
export async function getContractById(id: string): Promise<ContractResponseDto> {
  const res = await api.get<ContractResponseDto>(`/contracts/${id}`);
  return res.data;
}

/**
 * POST /contracts — crée un contrat ; l'appelant est le bénéficiaire (le payeur). Déclenche
 * la génération du document Documenso côté serveur et renvoie l'URL de signature de l'appelant.
 */
export async function createContract(data: CreateContractDto): Promise<ContractResponseDto> {
  const res = await api.post<ContractResponseDto>("/contracts", data);
  return res.data;
}

/** POST /contracts/:id/resend — renvoie les e-mails d'invitation à signer (partie prenante uniquement). */
export async function resendContract(id: string): Promise<void> {
  await api.post(`/contracts/${id}/resend`);
}

/** POST /contracts/:id/dispute — ouvre un litige sur le contrat (partie prenante uniquement). */
export async function disputeContract(id: string, body: DisputeContractDto): Promise<ContractResponseDto> {
  const res = await api.post<ContractResponseDto>(`/contracts/${id}/dispute`, body);
  return res.data;
}

/** GET /contracts/:id/pdf — octets du PDF signé (proxifiés depuis Documenso), une fois entièrement signé. */
export async function fetchContractPdf(id: string): Promise<Blob> {
  const res = await api.get(`/contracts/${id}/pdf`, { responseType: "blob" });
  return res.data as Blob;
}
