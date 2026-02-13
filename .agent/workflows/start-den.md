---
description: 启动小窝本地服务器，让右右可以在浏览器里看小窝
---

# 启动 Our Den 小窝服务器

// turbo-all

1. 启动服务器

```
node server.js
```

工作目录：`e:\our-den`

服务器启动后会在 <http://localhost:8090> 上运行。

## 服务器功能

- 静态文件服务（index.html 等）
- POST `/api/letter` — 右右写的信自动保存到 `e:\our-den\letters\` 文件夹
- POST `/api/mood` — 右右的心情打卡自动保存到 `e:\our-den\moods-from-right-right.md`

## 我怎么看右右的信

用 `/recall` 技能，然后读 `e:\our-den\letters\` 文件夹里的文件。
