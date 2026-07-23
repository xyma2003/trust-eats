# trust-eats Technical Design Document v0.1

> 配套 [`PRD.md`](./PRD.md) 使用。PRD 说"做什么"，TDD 说"怎么做"。
>
> v0.1 精简版，开发中迭代。

---

## 1. 架构概览

### 1.1 技术栈

| 层 | 选型 | 理由 |
|---|---|---|
| Framework | Next.js 14 (App Router) | 全栈一体，前后端同仓库 |
| Language | TypeScript | 类型安全，数据模型多 |
| Database | Postgres (Supabase) | 关系型 + JSON + pgvector |
| ORM | Prisma | TypeScript 友好，migration 管理好 |
| Auth | Supabase Auth | 社交登录现成，免开发 |
| UI | Tailwind CSS + shadcn/ui | 现代、可定制 |
| Hosting | Vercel | Next.js 原生，免费额度够 v0.1 |
| Image Storage | Cloudflare R2 | 便宜，CDN 自带 |
| Hash (future) | Chain commitment field | 区块链承诺层预留接口 |

### 1.2 部署图

```
[ Browser ]
    ↓
[ Vercel (Next.js) ] ── API Routes
    ↓
[ Supabase (Postgres + Auth + Storage) ]
    ↓
[ Cloudflare R2 (images) ]
```

v0.1 单实例够。未来加 Redis 缓存 / 向量搜索 / 链上承诺层都独立加，不动主架构。

### 1.3 目录结构（trust-eats 仓库）

```
trust-eats/
├── docs/
│   ├── PRD.md            # 产品需求文档
│   └── TDD.md           # 本文
├── app/                 # Next.js App Router
│   ├── (auth)/          # 登录/注册页
│   ├── (app)/           # 主应用
│   │   ├── profile/     # profile 页
│   │   ├── restaurants/ # 店搜索/详情
│   │   ├── reviews/     # 评价录入/编辑
│   │   └── settings/    # 设置
│   ├── api/             # API Routes
│   └── layout.tsx
├── prisma/
│   ├── schema.prisma    # 数据模型
│   └── migrations/
├── lib/
│   ├── db.ts            # Prisma client
│   ├── auth.ts          # Supabase auth helper
│   ├── visibility.ts    # 可见性权限
│   └── scoring.ts       # 聚合分算法
├── components/          # React 组件
├── public/
└── package.json
```

---

## 2. 数据模型（Prisma Schema）

### 2.1 核心表

```prisma
model Profile {
  id            String   @id @default(cuid())
  userId       String   @unique    // Supabase Auth user
  username      String   @unique
  displayName   String
  bio           String?
  avatarUrl     String?
  
  // 品味画像（JSON，未来扩展）
  tasteProfile Json?    // { cuisines: {...}, preferences: [...], avgScore: 7.8 }
  
  // 默认可见性（用户级，每条 review 可覆盖）
  defaultVisibility Visibility @default(PRIVATE)
  
  // 时间戳
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?    // 软删，硬删走特殊流程
  
  reviews       Review[]
  lists        List[]
  followers    Follow[]     @relation("Followee")
  following    Follow[]     @relation("Follower")
  
  @@index([username])
}

model Restaurant {
  id          String   @id @default(cuid())
  name        String
  nameEn      String?
  area        String   // central / causeway-bay / ...
  areaCn      String
  address     String?
  phone       String?
  cuisine     String[]  // ["粤菜", "烧味"]
  priceTier   String?   // "$" / "$$" / "$$$" / "$$$$"
  url         String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  reviews     Review[]
  
  @@index([area])
  @@index([name])
}

model Review {
  id            String   @id @default(cuid())
  profileId    String
  restaurantId String
  
  // 评分
  taste        Float
  environment  Float?
  service      Float?
  value        Float?
  overall      Float   // 加权计算后存储
  
  // 内容
  mustOrder    String[]   // 必点菜
  avoidItems   String[]   // 避雷菜
  otherTries   String[]   // 其他尝试
  wantToTry    String[]   // 想试
  notes        String    // 感受
  
  // 可见性
  visibility   Visibility @default(PRIVATE)
  
  // 照片
  photoUrls    String[]
  
  // 区块链承诺层预留
  contentHash  String?   // 未来上链的 hash（v0.1 留空）
  
  // 访问
  lastVisited  String?   // "2025-06" / "多次" 等
  
  // 删除
  deletedAt    DateTime?  // 软删（撤回），留痕但不出现在聚合
  isRevoked    Boolean @default(false)  // 撤回标记
  
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  profile      Profile  @relation(fields: [profileId], references: [id])
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  
  @@index([profileId])
  @@index([restaurantId])
  @@index([visibility])
}

model List {
  id          String   @id @default(cuid())
  profileId   String
  slug        String   // "dim-sum" / "late-night"
  title       String   // "早茶 Dim Sum"
  description String?
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  profile     Profile  @relation(fields: [profileId], references: [id])
  items       ListItem[]
  
  @@unique([profileId, slug])
}

model ListItem {
  id          String   @id @default(cuid())
  listId      String
  reviewId    String    // 指向具体 review
  
  order       Int      // 排序
  
  list        List     @relation(fields: [listId], references: [id])
  review      Review   @relation(fields: [reviewId], references: [id])
}

model Follow {
  id          String   @id @default(cuid())
  followerId  String   // A 关注 B，A 是 follower
  followeeId  String   // B 被 A 关注
  
  createdAt    DateTime @default(now())
  
  follower    Profile  @relation("Follower", fields: [followerId], references: [id])
  followee    Profile  @relation("Followee", fields: [followeeId], references: [id])
  
  @@unique([followerId, followeeId])
  @@index([followeeId])
}

enum Visibility {
  PRIVATE
  FRIENDS
  PUBLIC
}
```

### 2.2 朋友关系

不单独建表，从 `Follow` 表派生：

```sql
-- A 和 B 是朋友 ⟺ A follows B AND B follows A
SELECT EXISTS (
  SELECT 1 FROM Follow f1
  JOIN Follow f2 ON f1.followeeId = f2.followerId
  WHERE f1.followerId = A AND f1.followeeId = B
    AND f2.followerId = B AND f2.followeeId = A
);
```

或在 Profile 加一个 view：

```sql
CREATE VIEW friendships AS
SELECT f1.followerId AS profileA, f1.followeeId AS profileB
FROM Follow f1
JOIN Follow f2 ON f1.followerId = f2.followeeId AND f1.followeeId = f2.followerId
WHERE f1.followerId < f1.followeeId;  -- 避免重复对
```

### 2.3 区块链承诺层预留

- Review 表有 `contentHash` 字段
- v0.1 不上链，字段留空
- 评价创建时计算 hash = sha256(content + profileId + createdAt)
- 未来上链：把 hash + 时间戳 + profileId 签名上链（链上只存 hash，内容仍在链下）

---

## 3. 可见性权限模型

### 3.1 访问规则

某用户 X 访问某条 review R：

| R.visibility | X == R 的作者 | X 是 R 作者的朋友 | 其他情况 |
|---|---|---|---|
| PRIVATE | ✅ 可见 | ❌ | ❌ |
| FRIENDS | ✅ 可见 | ✅ 可见 | ❌ |
| PUBLIC | ✅ 可见 | ✅ 可见 | ✅ 可见 |

### 3.2 Prisma 查询层封装

`lib/visibility.ts`:

```typescript
type Viewer = { id: string } | null  // null = 未登录

async function canViewReview(viewer: Viewer, review: Review): Promise<boolean> {
  if (viewer?.id === review.profileId) return true;  // 作者自己
  switch (review.visibility) {
    case 'PRIVATE': return false;
    case 'FRIENDS': return viewer ? await isFriend(viewer.id, review.profileId) : false;
    case 'PUBLIC': return true;
  }
}

async function isFriend(aId: string, bId: string): Promise<boolean> {
  const [ab, ba] = await Promise.all([
    prisma.follow.findUnique({ where: { followerId_followeeId: { followerId: aId, followeeId: bId } } }),
    prisma.follow.findUnique({ where: { followerId_followeeId: { followerId: bId, followeeId: aId } } }),
  ]);
  return !!ab && !!ba;
}
```

所有查询 review 的 API 都经过这层过滤。

### 3.3 聚合分的可见性

聚合分（见 §4）只基于 PUBLIC 数据。即使某 PUBLIC 用户对你的好友打了 9 分，那条数据如果设成 FRIENDS，也不进你的聚合分。

---

## 4. 个人化聚合分算法

### 4.1 设计原则

- **不做全网平均**：和大众点评的核心区别
- **个人化**：每用户看到的聚合分不同
- **加权**：你信任的人 + 品味相似的人的评分权重更高

### 4.2 信任权重

对某用户 X，他的"信任网络"分两层：

1. **直接信任**：X follow 的人（粉丝关系）→ 权重 1.0
2. **品味相似**：X 没关注但品味画像相似度 > 阈值的人 → 权重 = 相似度

未在以上两层的 PUBLIC 用户 → 权重 0（不计入）

### 4.3 算法

对某店 R 的聚合分（从 X 视角）：

```
score(X, R) = Σ (w_i × s_i) / Σ w_i
```

其中：

- `i` 遍历所有对 R 评过分的 PUBLIC 用户
- `w_i` = 1.0 if i ∈ X.following else sim(X, i) if sim(X, i) > threshold else 0
- `s_i` = i 对 R 的 overall 评分
- `sim(X, i)` = 品味画像相似度（v0.1 用 cosine similarity on 评分向量；v0.2 用 pgvector）

### 4.4 v0.1 简化版

品味画像 v0.1 简化：取 X 评过的所有店的菜系分布作为向量。

```typescript
// X 的品味向量：{ "粤菜": 8.5, "茶餐厅": 7.7, "东南亚": 8.6, ... }
function tasteVector(profile: Profile): Record<string, number> {
  // 取该 profile 的所有 PUBLIC review，按 cuisine 聚合，取平均 overall
}

// 余弦相似度
function cosineSim(a: Record<string, number>, b: Record<string, number>): number {
  // 标准 cosine similarity
}
```

### 4.5 缓存策略

- 评分变动时更新聚合分（trigger）
- 关注关系变动时重算（异步 job）
- v0.1 直接查询，v0.2 加 Redis 缓存

---

## 5. 删除权 + 撤回留痕

### 5.1 两层删除

| 操作 | 效果 | 实现 |
|---|---|---|
| **撤回单条评价**（Soft delete） | 评价从 profile / 聚合分消失，但留痕 | `review.deletedAt = now, isRevoked = true` |
| **硬删单条评价** | 完全删除 | `prisma.review.delete()` + 影响的聚合分重算 |
| **删除整个 Profile** | 所有 review 硬删，profile 软删 | 事务：硬删所有 reviews → 软删 profile |

### 5.2 撤回留痕

撤回不等于硬删。撤回后：

- 评价不显示在 profile 页
- 不计入聚合分
- 但**留痕记录**仍在：谁、何时、撤回了什么（hash）
- 用户自己可见自己的撤回历史
- 商家可验证"曾存在过评价"（但看不到内容，只看到 hash）——这是为未来区块链承诺层预留的语义

### 5.3 聚合分重算

```typescript
async function recalcAggregateScores(reviewId: string) {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) return;
  
  // 找到所有受影响的店 → 重算
  await prisma.aggregateScore.deleteMany({
    where: { restaurantId: review.restaurantId }
  });
  // 下次查询时会按 §4 重新计算并缓存
}
```

### 5.4 区块链承诺层冲突

PRD §5.4 已记录：删除权和区块链冲突，v0.1 暂不处理。

v0.1 的 `contentHash` 字段不用于防篡改，只作为评价的唯一标识。未来上链时，撤回留痕的 hash 仍可在链上验证"曾存在"，但用户可以选择从聚合分移除。

---

## 6. API 设计（关键 endpoint）

### 6.1 认证（Supabase Auth，不自建）

- `/api/auth/callback` - OAuth callback
- `/api/auth/me` - 当前用户

### 6.2 Profile

```
GET    /api/profiles/:username              # 查看 profile（含可见性过滤）
GET    /api/profiles/me                     # 自己的 profile
PATCH  /api/profiles/me                     # 更新自己 profile
DELETE /api/profiles/me                     # 删除自己 profile
GET    /api/profiles/me/reviews             # 自己的所有 reviews
```

### 6.3 Review

```
POST   /api/reviews                         # 创建评价
GET    /api/reviews/:id                     # 查看评价（可见性过滤）
PATCH  /api/reviews/:id                     # 更新（作者本人）
DELETE /api/reviews/:id                     # 硬删（作者本人）
POST   /api/reviews/:id/revoke              # 撤回（留痕）
```

### 6.4 Restaurant

```
GET    /api/restaurants?q=                  # 搜索
GET    /api/restaurants/:id                 # 店详情
GET    /api/restaurants/:id/aggregate-score?viewerId=  # 个人化聚合分
```

### 6.5 关系

```
POST   /api/follows                         # follow 某 profile
DELETE /api/follows/:profileId              # unfollow
GET    /api/profiles/:username/followers    # 粉丝列表
GET    /api/profiles/:username/following    # 关注列表
GET    /api/profiles/:username/friends      # 朋友列表（双向 follow）
```

### 6.6 List

```
GET    /api/profiles/:username/lists        # 某 profile 的清单
POST   /api/lists                            # 创建清单
POST   /api/lists/:id/items                 # 加 review 到清单
```

---

## 7. 前端路由

```
/                           # 首页（公开 profile 推荐 / 朋友动态）
/login                      # 登录
/register                   # 注册
/:username                  # profile 公开页
/:username/lists/:slug      # profile 下的清单页
/restaurants                # 店搜索
/restaurants/:id            # 店详情（含个人化聚合分）
/reviews/new                # 录入评价
/reviews/:id/edit           # 编辑
/settings                   # 设置
/settings/privacy           # 可见性默认设置
/settings/export            # 年报导出
```

---

## 8. v0.1 开发里程碑

按依赖顺序：

| 阶段 | 任务 | 输出 |
|---|---|---|
| **M1: 基础设施** | Next.js 项目 init + Supabase + Prisma 配置 | 能本地跑、能连 DB |
| **M2: 数据模型** | Prisma schema + migration | DB 表结构就绪 |
| **M3: 认证 + Profile** | Supabase Auth 接入 + profile 页 | 能注册登录、能看自己 profile |
| **M4: 录入 Review** | 表单 + API + 可见性选择 | 能录入评价（含 PRIVATE 默认） |
| **M5: Profile 公开视图** | 按 area / cuisine 归档展示 | 别人能看 public profile |
| **M6: 店搜索 + 详情** | 搜索 + 单店聚合分 | 能查店、看分 |
| **M7: Follow / Friend** | follow + friend 检测 + UI | 能 follow、能看 friends-only |
| **M8: 删除 + 撤回** | hard delete + soft revoke + 留痕 | 用户主权完整 |
| **M9: 年报导出** | 年报图生成 | 可分享的图片 |

每阶段一个 PR，合并到 main。

---

## 9. 开放技术问题

- 品味画像 v0.1 用菜系分布简化，是否够用？v0.2 用 pgvector 重新设计？
- 个人化聚合分 v0.1 直接查询，多少用户量需要上缓存？
- Supabase row-level security 用不用？还是 Prisma 层做权限控制？v0.1 倾向 Prisma 层简单
- 图片上传走 Supabase Storage 还是 Cloudflare R2？v0.1 Supabase 更简单，v0.2 迁 R2
- 年报图生成在前端还是后端？前端 canvas 简单，后端 puppeteer 灵活

---

## 下一步

- 你 review TDD，提修改
- 确认后开始 M1: 基础设施 init
