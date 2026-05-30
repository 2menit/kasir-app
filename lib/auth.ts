import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/** Thrown messages bubble up to NextAuth as the `error` query param. */
class AuthError extends Error {}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours (SRS FR-AUTH-2)
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) throw new AuthError("Username atau password salah");

        const { username, password } = parsed.data;
        const user = await prisma.user.findUnique({ where: { username } });

        // Generic message — never reveal which field is wrong (FR-AUTH-1).
        if (!user) throw new AuthError("Username atau password salah");

        // Account lockout check (REQ-AUTH-01)
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new AuthError(
            "Akun terkunci sementara. Coba lagi dalam 15 menit."
          );
        }

        const valid = await bcrypt.compare(password, user.password);

        if (!valid) {
          const attempts = user.failedLoginAttempts + 1;
          const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;
          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: shouldLock ? 0 : attempts,
              lockedUntil: shouldLock
                ? new Date(Date.now() + LOCK_DURATION_MS)
                : user.lockedUntil,
            },
          });
          if (shouldLock) {
            throw new AuthError(
              "Terlalu banyak percobaan gagal. Akun terkunci 15 menit."
            );
          }
          throw new AuthError("Username atau password salah");
        }

        // Success — reset lockout counters.
        if (user.failedLoginAttempts !== 0 || user.lockedUntil) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        name: token.name as string,
        username: token.username,
        role: token.role,
      };
      return session;
    },
  },
};
