# trust-eats

> Trust-based restaurant review network. People-first, not place-first.

以人为维度的餐厅评价网络。不是大众点评的竞品，是 trust network。

## 为什么

现有餐饮评价平台（大众点评、Google Maps、小红书）的根本缺陷：单店维度、匿名众数、数据归平台。刷单成本低，信任靠平台治理维持。

trust-eats 把信任单位从"店"转移到"人"。一个用户的全部餐厅清单 + 评分 + 偏好画像作为一个整体被评估。要刷单得伪装一个长期、一致、有品味信号的真人 profile，成本陡增。

## 核心设计

- **可见性三档**：Private / Friends / Public。只有 Public 数据进系统推荐池
- **关系两层**：单向 follow = 粉丝；双向 follow = 朋友
- **个人化加权聚合分**：不做全网平均分。同一家店你看到的分基于你信任的人，和陌生人看到的不同
- **数据主权**：profile 删除 → 系统级硬删 + 重算；年报图导出

## 当前状态

- v0.1 PRD 写好，见 [`docs/PRD.md`](docs/PRD.md)
- 个人样板数据：[hk_meal](https://github.com/xyma2003/hk_meal) 仓库，12 家香港餐厅
- 下一步：PRD 扩展到 v0.2 + 个人样板做厚到 30 家

## 讨论

v0.1 PRD 是精简版，讨论后扩展。欢迎在 issue 里提建议。
