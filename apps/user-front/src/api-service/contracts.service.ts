import type { ContractResponseDto, CreateContractDto, ContractQueryDto } from "@repo/contracts";
import api from "./api";

// All contract data (including the signed PDF) is served by our api, which is the
// sole gateway to Documenso — the front never talks to Documenso/S3 directly.

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

// POST /contracts — create a contract; the caller is the beneficiary (payer). This
// kicks off Documenso document generation server-side and returns the signing URL.
export async function createContract(data: CreateContractDto): Promise<ContractResponseDto> {
  const res = await api.post<ContractResponseDto>("/contracts", data);
  return res.data;
}

// POST /contracts/:id/resend — re-send the signing invitation emails (party only).
export async function resendContract(id: string): Promise<void> {
  await api.post(`/contracts/${id}/resend`);
}

// GET /contracts/:id/pdf — the signed PDF bytes (proxied from Documenso). Only
// available once the contract is fully signed; returns a Blob for react-pdf.
export async function fetchContractPdf(id: string): Promise<Blob> {
  const res = await api.get(`/contracts/${id}/pdf`, { responseType: "blob" });
  return res.data as Blob;
}
