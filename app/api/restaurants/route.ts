import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

const CreateRestaurantSchema = z.object({
  name: z.string().min(1).max(128),
  nameEn: z.string().max(128).optional(),
  area: z.string().min(1).max(64),
  areaCn: z.string().min(1).max(64),
  address: z.string().optional(),
  phone: z.string().optional(),
  cuisine: z.array(z.string()).min(1),
  priceTier: z.enum(["$", "$$", "$$$", "$$$$"]).optional(),
  url: z.string().url().optional().or(z.literal("")),
});

// POST /api/restaurants - 创建店
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = CreateRestaurantSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const r = parsed.data;
    const restaurant = await prisma.restaurant.create({
      data: {
        name: r.name,
        nameEn: r.nameEn || null,
        area: r.area,
        areaCn: r.areaCn,
        address: r.address || null,
        phone: r.phone || null,
        cuisine: JSON.stringify(r.cuisine),
        priceTier: r.priceTier || null,
        url: r.url || null,
        createdById: user.profile.id,
      },
    });
    return NextResponse.json({ restaurant });
  } catch (e) {
    console.error("[restaurants POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
