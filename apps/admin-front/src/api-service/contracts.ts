import type { ContractResponseDto } from "@repo/contracts";
import api from "./api";
import type { ListParams, Paginated } from "./types";

export async function listContracts(params: ListParams): Promise<Paginated<ContractResponseDto>> {
  const res = await api.get<Paginated<ContractResponseDto>>("/contracts", { params });
  return res.data;
}

export async function getContract(id: string): Promise<ContractResponseDto> {
  const res = await api.get<ContractResponseDto>(`/contracts/${id}`);
  return res.data;
}

export async function deleteContract(id: string): Promise<void> {
  await api.delete(`/contracts/${id}`);
}
