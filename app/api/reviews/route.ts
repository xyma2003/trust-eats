import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { hashContent } from "@/lib/review-utils";

const CreateReviewSchema = z.object({
  restaurantId: z.string().min(1).optional(),
  // 如果没传 restaurantId，传新店字段
  newRestaurant: z
    .object({
      name: z.string().min(1).max(128),
      nameEn: z.string().max(128).optional(),
      area: z.string().min(1).max(64),
      areaCn: z.string().min(1).max(64),
      address: z.string().optional(),
      phone: z.string().optional(),
      cuisine: z.array(z.string()).min(1),
      priceTier: z.enum(["$", "$$", "$$$", "$$$$"]).optional(),
      url: z.string().optional(),
    })
    .optional(),
  taste: z.number().min(0).max(10),
  environment: z.number().min(0).max(10).optional(),
  service: z.number().min(0).max(10).optional(),
  value: z.number().min(0).max(10).optional(),
  mustOrder: z.array(z.string()).default([]),
  avoidItems: z.array(z.string()).default([]),
  otherTries: z.array(z.string()).default([]),
  wantToTry: z.array(z.string()).default([]),
  notes: z.string().default(""),
  visibility: z.enum(["PRIVATE", "FRIENDS", "PUBLIC"]).default("PRIVATE"),
  lastVisited: z.string().max(32).optional(),
});

function calcOverall(
  taste: number,
  environment: number | undefined,
  service: number | undefined,
  value: number | undefined
): number {
  // 味道×0.5 + 环境×0.15 + 服务×0.15 + 性价比×0.2
  // 缺失维度按"未打分不参与 + 权重归一化"处理
  const weights: [number, number | undefined, number][] = [
    [0.5, taste, 1],
    [0.15, environment, 0.5],
    [0.15, service, 0.5],
    [0.2, value, 0.5],
  ];
  let total = 0;
  let totalW = 0;
  for (const [w, val, defaultW] of weights) {
    if (val === undefined) {
      // 缺失：用该维度的默认权重归一化给其他维度
      totalW += w;
    } else {
      total += val * w;
      totalW += w;
    }
    // defaultW unused, kept for clarity
    void defaultW;
  }
  // 归一化
  const usedW = weights.reduce((acc, [w, v]) => acc + (v === undefined ? 0 : w), 0);
  if (usedW === 0) return 0;
  return Math.round((total / usedW) * 10) / 10;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const parsed = CreateReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;

    // 处理 restaurant：用 existing id 或 new
    let restaurantId = d.restaurantId;
    if ((!restaurantId || restaurantId === "") && d.newRestaurant) {
      const nr = d.newRestaurant;
      const r = await prisma.restaurant.create({
        data: {
          name: nr.name,
          nameEn: nr.nameEn || null,
          area: nr.area,
          areaCn: nr.areaCn,
          address: nr.address || null,
          phone: nr.phone || null,
          cuisine: JSON.stringify(nr.cuisine),
          priceTier: nr.priceTier || null,
          url: nr.url || null,
          createdById: user.profile.id,
        },
      });
      restaurantId = r.id;
    }
    if (!restaurantId) {
      return NextResponse.json({ error: "restaurantId or newRestaurant required" }, { status: 400 });
    }

    // 检查店是否存在
    const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    // 检查是否已评价过（同一 profile 同一 restaurant 不能重复）
    const existing = await prisma.review.findFirst({
      where: { profileId: user.profile.id, restaurantId, deletedAt: null },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already reviewed this restaurant. Edit it instead." },
        { status: 409 }
      );
    }

    const overall = calcOverall(d.taste, d.environment, d.service, d.value);

    // contentHash：v0.1 简单 hash，未来上链用
    const contentHash = hashContent({
      profileId: user.profile.id,
      restaurantId,
      taste: d.taste,
      overall,
      notes: d.notes,
    });

    const review = await prisma.review.create({
      data: {
        profileId: user.profile.id,
        restaurantId,
        taste: d.taste,
        environment: d.environment,
        service: d.service,
        value: d.value,
        overall,
        mustOrder: JSON.stringify(d.mustOrder),
        avoidItems: JSON.stringify(d.avoidItems),
        otherTries: JSON.stringify(d.otherTries),
        wantToTry: JSON.stringify(d.wantToTry),
        notes: d.notes,
        visibility: d.visibility,
        photoUrls: JSON.stringify([]),
        contentHash,
        lastVisited: d.lastVisited || null,
      },
      include: { restaurant: true },
    });

    return NextResponse.json({ review });
  } catch (e) {
    console.error("[reviews POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
