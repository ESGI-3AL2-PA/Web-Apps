import { describe, expect, it } from "vitest";
import { CreateEventDtoSchema } from "@repo/contracts";

const base = {
  districtId: "district-1",
  title: "Cleanup",
  description: "Neighbourhood cleanup",
  location: "Place du Tertre",
  totalSeats: 20,
};

describe("CreateEventDtoSchema future-date guard", () => {
  it("rejects an eventDate in the past", () => {
    const parsed = CreateEventDtoSchema.safeParse({ ...base, eventDate: "2020-01-01T10:00:00.000Z" });
    expect(parsed.success).toBe(false);
  });

  it("accepts an eventDate in the future", () => {
    const parsed = CreateEventDtoSchema.safeParse({ ...base, eventDate: "2999-01-01T10:00:00.000Z" });
    expect(parsed.success).toBe(true);
  });
});
