import { test, expect } from "@playwright/test";
import type { CreateUserDto, UserResponseDto, UpdateUserDto } from "@repo/contracts";

const BASE = "http://localhost:3000";

const newUser = (overrides: Partial<CreateUserDto> = {}): CreateUserDto => ({
  firstName: "Test",
  lastName: "User",
  email: `test-email@example.com`,
  password: "password123",
  address: "21 rue louise michel 93170",
  ...overrides,
});

test.describe("GET /users", () => {
  test("returns a paginated list of users", async ({ request }) => {
    const res = await request.get(`${BASE}/users`);
    expect(res.status()).toBe(200);

    const body: { data: UserResponseDto[]; total: number; page: number; limit: number } = await res.json();
    expect(body).toHaveProperty("data");
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("page");
    expect(body).toHaveProperty("limit");
    expect(Array.isArray(body.data)).toBe(true);
  });
});

test.describe("POST /users", () => {
  test("creates a new user", async ({ request }) => {
    const res = await request.post(`${BASE}/users`, { data: newUser() });
    expect(res.status()).toBe(201);

    const user: UserResponseDto = await res.json();
    expect(user).toHaveProperty("id");
    expect(user.firstName).toBe("Test");
    expect(user.lastName).toBe("User");
    expect(user.role).toBe("user");
    expect(user).not.toHaveProperty("passwordHash");
  });

  test("returns created user via GET /users/:id", async ({ request }) => {
    const createRes = await request.post(`${BASE}/users`, {
      data: newUser({ firstName: "Lookup", lastName: "User" }),
    });
    const created: UserResponseDto = await createRes.json();

    const res = await request.get(`${BASE}/users/${created.id}`);
    expect(res.status()).toBe(200);

    const user: UserResponseDto = await res.json();
    expect(user.id).toBe(created.id);
    expect(user.firstName).toBe("Lookup");
    expect(user.lastName).toBe("User");
  });
});

test.describe("GET /users/:id", () => {
  test("returns 404 for unknown id", async ({ request }) => {
    const res = await request.get(`${BASE}/users/000000000000000000000000`);
    expect(res.status()).toBe(404);

    const body = await res.json();
    expect(body).toHaveProperty("message");
  });
});

test.describe("PATCH /users/:id", () => {
  test("updates a user's name", async ({ request }) => {
    const createRes = await request.post(`${BASE}/users`, {
      data: newUser({ firstName: "Before", lastName: "Update" }),
    });
    const created: UserResponseDto = await createRes.json();

    const patch: UpdateUserDto = { firstName: "After", lastName: "Update" };
    const patchRes = await request.patch(`${BASE}/users/${created.id}`, { data: patch });
    expect(patchRes.status()).toBe(200);

    const updated: UserResponseDto = await patchRes.json();
    expect(updated.firstName).toBe("After");
    expect(updated.id).toBe(created.id);
  });

  test("returns 404 when updating unknown user", async ({ request }) => {
    const patch: UpdateUserDto = { firstName: "Ghost" };
    const res = await request.patch(`${BASE}/users/000000000000000000000000`, { data: patch });
    expect(res.status()).toBe(404);
  });
});

test.describe("DELETE /users/:id", () => {
  test("deletes a user", async ({ request }) => {
    const createRes = await request.post(`${BASE}/users`, {
      data: newUser({ firstName: "To", lastName: "Delete" }),
    });
    const created: UserResponseDto = await createRes.json();

    const deleteRes = await request.delete(`${BASE}/users/${created.id}`);
    expect(deleteRes.status()).toBe(204);

    const getRes = await request.get(`${BASE}/users/${created.id}`);
    expect(getRes.status()).toBe(404);
  });

  test("returns 404 when deleting unknown user", async ({ request }) => {
    const res = await request.delete(`${BASE}/users/000000000000000000000000`);
    expect(res.status()).toBe(404);
  });
});
