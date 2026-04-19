# apps/web-next

**状态**：🚧 重写期并行脚手架（RW-SETUP-01）

## 用途

`apps/web-next/` 是 `apps/web/` 的并行重写版本。旧应用保持生产可用，新应用按里程碑逐步接管路由。

| 里程碑 | 接管内容 |
|--------|---------|
| M2 | homepage |
| M3 | player (/watch/*, /movie/*) |
| M4 | auth |
| M5 | search + 弹幕 |
| M6 | admin 全量；旧应用下线 |
| M6-RENAME | `git mv apps/web-next apps/web` |

## 开发

```bash
# 单独启动（port 3002）
npm run dev --workspace=@resovo/web-next

# 验收页
http://localhost:3002/en/next-placeholder
```

## 与 apps/web/ 的关系

- `apps/web/`：只读，除部署配置外不接受业务改动
- `apps/web-next/`：新业务写在这里
- 路由切分由 middleware ALLOWLIST 控制（见 ADR-035，RW-SETUP-02 实现）
