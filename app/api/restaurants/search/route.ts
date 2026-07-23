import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/restaurants/search?q=xxx
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }
  // SQLite LIKE 不支持不区分大小写除非用 LIKE + UPPER
  const results = await prisma.restaurant.findMany({
    where: {
      OR: [{ name: { contains: q } }, { nameEn: { contains: q } }],
    },
    take: 10,
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ results });
}
