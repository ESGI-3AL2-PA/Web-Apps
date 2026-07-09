import { z } from "../zod";

export const NotFoundErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi({ title: "NotFoundError", description: "Resource not found error" });
export type NotFoundError = z.infer<typeof NotFoundErrorSchema>;

export const BadRequestErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi({ title: "BadRequestError", description: "Invalid request (e.g. insufficient balance)" });
export type BadRequestError = z.infer<typeof BadRequestErrorSchema>;

export const BadGatewayErrorSchema = z
  .object({
    message: z.string(),
  })
  .openapi({ title: "BadGatewayError", description: "An upstream dependency failed (e.g. the e-signature service)" });
export type BadGatewayError = z.infer<typeof BadGatewayErrorSchema>;
