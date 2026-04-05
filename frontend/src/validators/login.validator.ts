import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(3, "Username or badge number is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export type LoginInput = z.infer<typeof loginSchema>;
