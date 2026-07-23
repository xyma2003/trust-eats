import { cookies } from "next/headers";
import { prisma } from "./db";
import { verifySession, SESSION_COOKIE_NAME } from "./auth";

export type SessionUser = {
  id: string;
  email: string;
  profile: {
    id: string;
    username: string;
    displayName: string;
  } | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifySession(token);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { profile: true },
  });
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    profile: user.profile
      ? {
          id: user.profile.id,
          username: user.profile.username,
          displayName: user.profile.displayName,
        }
      : null,
  };
}
