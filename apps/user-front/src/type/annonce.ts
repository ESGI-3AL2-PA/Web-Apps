export type ListingResponseDto = {
    description: string;
    type: "offer" | "request";
    status: "active" | "closed" | "expired";
    id: string;
    title: string;
    price: number;
}