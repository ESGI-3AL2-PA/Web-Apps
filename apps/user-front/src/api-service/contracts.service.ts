import type {
  ContractQueryDto,
  ContractResponseDto,
  ContractResponseDtoSchema,
  CreateContractDto,
  DisputeContractDto,
  PaginatedResponseDto,
  SignContractDto,
} from "@repo/contracts";

type PaginatedContracts = PaginatedResponseDto<typeof ContractResponseDtoSchema>;

export async function getContracts(
  _filters: ContractQueryDto = {} as ContractQueryDto,
): Promise<PaginatedContracts> {
  throw new Error("Not implemented");
}

export async function getContractById(_id: string): Promise<ContractResponseDto> {
  throw new Error("Not implemented");
}

export async function createContract(_data: CreateContractDto): Promise<ContractResponseDto> {
  throw new Error("Not implemented");
}

export async function signContract(_id: string, _data: SignContractDto): Promise<ContractResponseDto> {
  throw new Error("Not implemented");
}

export async function disputeContract(_id: string, _data: DisputeContractDto): Promise<ContractResponseDto> {
  throw new Error("Not implemented");
}

export async function deleteContract(_id: string): Promise<void> {
  throw new Error("Not implemented");
}
