import type { ContractQueryDto, ContractResponseDto, CreateContractDto, DisputeContractDto } from "@repo/contracts";
import api from "./api";

// The api is the sole gateway to Documenso — the front never talks to Documenso/S3
// directly. Contracts are the e-signature layer on top of a taken listing.
export interface PaginatedContracts {
  data: ContractResponseDto[];
  total: number;
  page: number;
  limit: number;
}

// GET /contracts — the caller's contracts (paginated, optional filters).
export async function getContracts(filters: Partial<ContractQueryDto> = {}): Promise<PaginatedContracts> {
  const res = await api.get<PaginatedContracts>("/contracts", { params: filters });
  return res.data;
}

// GET /contracts/:id — a single contract (party or admin).
export async function getContractById(id: string): Promise<ContractResponseDto> {
  const res = await api.get<ContractResponseDto>(`/contracts/${id}`);
  return res.data;
}

// POST /contracts — create a contract; the caller is the beneficiary (payer). Kicks
// off Documenso document generation server-side and returns the caller's signing URL.
export async function createContract(data: CreateContractDto): Promise<ContractResponseDto> {
  const res = await api.post<ContractResponseDto>("/contracts", data);
  return res.data;
}

// POST /contracts/:id/resend — re-send the signing invitation emails (party only).
export async function resendContract(id: string): Promise<void> {
  await api.post(`/contracts/${id}/resend`);
}

// POST /contracts/:id/dispute — raise a dispute on the contract (party only).
export async function disputeContract(id: string, body: DisputeContractDto): Promise<ContractResponseDto> {
  const res = await api.post<ContractResponseDto>(`/contracts/${id}/dispute`, body);
  return res.data;
}

// GET /contracts/:id/pdf — signed PDF bytes (proxied from Documenso), once fully signed.
export async function fetchContractPdf(id: string): Promise<Blob> {
  const res = await api.get(`/contracts/${id}/pdf`, { responseType: "blob" });
  return res.data as Blob;
}
