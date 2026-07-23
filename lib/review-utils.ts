import { createHash } from "crypto";

/**
 * v0.1 简单 content hash。未来上链承诺层时改用更严格的 hash + 签名。
 */
export function hashContent(content: Record<string, unknown>): string {
  const json = JSON.stringify(content);
  return createHash("sha256").update(json).digest("hex");
}

/**
 * 解析 SQLite 里存的 JSON string array，安全降级 []
 */
export function parseStringArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const parsed = JSON.parse(s);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
