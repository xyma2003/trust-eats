import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

// DELETE /api/reviews/:id - 硬删评价
// TDD §5.1：完全删除 + 聚合分重算（v0.1 不缓存，查询时重算）
export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (review.profileId !== user.profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 硬删：先删关联的 ListItem（如果有），再删 review
  await prisma.listItem.deleteMany({ where: { reviewId: id } });
  await prisma.review.delete({ where: { id } });

  // v0.1 聚合分不缓存，查询时重算，所以这里不需要显式更新
  // v0.2 加缓存时，这里要触发 AggregateScore 重算

  return NextResponse.json({ ok: true });
}

// PATCH /api/reviews/:id - 更新评价（作者本人）
// v0.1 只支持更新部分字段；完整编辑表单留 v0.2
export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user || !user.profile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (review.profileId !== user.profile.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const allowed: Record<string, unknown> = {};
  for (const k of [
    "taste",
    "environment",
    "service",
    "value",
    "notes",
    "visibility",
    "lastVisited",
  ]) {
    if (k in body) allowed[k] = body[k];
  }

  // 重新算 overall（如果分数变了）
  if ("taste" in body || "environment" in body || "service" in body || "value" in body) {
    const taste = body.taste ?? review.taste;
    const env = body.environment ?? review.environment;
    const svc = body.service ?? review.service;
    const val = body.value ?? review.value;

    const dims: [number, number][] = [];
    if (env !== undefined && env !== null) dims.push([0.15, env as number]);
    if (svc !== undefined && svc !== null) dims.push([0.15, svc as number]);
    if (val !== undefined && val !== null) dims.push([0.2, val as number]);
    dims.push([0.5, taste as number]);

    const totalW = dims.reduce((acc, [w]) => acc + w, 0);
    const weighted = dims.reduce((acc, [w, v]) => acc + w * v, 0);
    allowed.overall = Math.round((weighted / totalW) * 10) / 10;
  }

  const updated = await prisma.review.update({
    where: { id },
    data: allowed,
  });

  return NextResponse.json({ review: updated });
}
