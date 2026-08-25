import type { Role } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      username: string;
      role: Role;
      cityId: string | null;
    };
  }

  interface User {
    id: string;
    name: string;
    username: string;
    role: Role;
    cityId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    username: string;
    role: Role;
    cityId: string | null;
  }
}
