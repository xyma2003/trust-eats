import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashPassword, signSession, setSessionCookie } from "@/lib/auth";

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, digits, _ or -"),
  displayName: z.string().min(1).max(64),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { email, password, username, displayName } = parsed.data;

    // 检查重复
    const [existingUser, existingProfile] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.profile.findUnique({ where: { username } }),
    ]);
    if (existingUser) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    if (existingProfile) {
      return NextResponse.json({ error: "Username taken" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        profile: {
          create: {
            username,
            displayName,
          },
        },
      },
      include: { profile: true },
    });

    const token = await signSession({ userId: user.id, email: user.email });
    const res = NextResponse.json({ ok: true, profile: { username, displayName } });
    res.headers.set("Set-Cookie", setSessionCookie(token));
    return res;
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
