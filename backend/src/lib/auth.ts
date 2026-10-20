import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { User } from "@prisma/client";

export const hashPassword = async (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = async (password: string, hash: string) => bcrypt.compare(password, hash);

export const generateResetToken = () => crypto.randomBytes(32).toString("hex");

export const signAccessToken = (app: FastifyInstance, user: User) =>
  app.jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    { expiresIn: "7d" },
  );
