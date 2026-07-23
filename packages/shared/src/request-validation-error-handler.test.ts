// Suite de tests du handler de validation de requête ts-rest : `validationMessage` (message
// personnalisé rendu tel quel, message zod générique préfixé du champ, priorité body > query,
// repli générique) et `requestValidationErrorHandler` (réponse 400 { message } propre, sans jamais
// divulguer la forme de la ZodError).
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { validationMessage, requestValidationErrorHandler } from "./request-validation-error-handler.js";

const zodError = (schema: z.ZodTypeAny, value: unknown): z.ZodError => {
  const r = schema.safeParse(value);
  if (r.success) throw new Error("expected the schema to reject the value");
  return r.error;
};

const empty = { pathParams: null, headers: null, query: null, body: null };

describe("validationMessage", () => {
  it("surfaces a custom refinement message verbatim (no field prefix)", () => {
    const password = z.string().refine((v) => /[^A-Za-z0-9]/.test(v), "Password must contain a symbol");
    const body = zodError(z.object({ password }), { password: "Abcdefgh1234" });
    expect(validationMessage({ ...empty, body })).toBe("Password must contain a symbol");
  });

  it("prefixes the field name onto a generic zod message", () => {
    const body = zodError(z.object({ email: z.string().email() }), { email: "nope" });
    expect(validationMessage({ ...empty, body })).toBe("email: Invalid email");
  });

  it("prefers body over query when both fail", () => {
    const body = zodError(z.object({ a: z.string() }), {});
    const query = zodError(z.object({ b: z.string() }), {});
    expect(validationMessage({ ...empty, body, query })).toBe("a: Required");
  });

  it("falls back to a generic message when there are no issues", () => {
    expect(validationMessage(empty)).toBe("Invalid request");
  });
});

describe("requestValidationErrorHandler", () => {
  it("responds 400 with a clean { message } and never echoes the ZodError shape", () => {
    const password = z.string().refine((v) => /[^A-Za-z0-9]/.test(v), "Password must contain a symbol");
    const body = zodError(z.object({ password }), { password: "Abcdefgh1234" });

    const json = vi.fn();
    const res = { status: vi.fn().mockReturnValue({ json }) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestValidationErrorHandler({ ...empty, body }, {} as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "Password must contain a symbol" });
    expect(json.mock.calls[0][0]).not.toHaveProperty("issues");
    expect(json.mock.calls[0][0]).not.toHaveProperty("name");
  });
});
