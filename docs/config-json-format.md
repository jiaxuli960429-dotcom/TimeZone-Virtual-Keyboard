# 配置 JSON 格式（Server + Agent）

## 存储层结构

云端在数据库中存储对象：

```json
{
  "id": 123,
  "ownerUserId": 9,
  "name": "默认87键",
  "visibility": "private",
  "content": {
    "...": "这里是键盘配置内容（原始配置 JSON）"
  }
}
```

其中 `content` 保持和前端现有配置结构一致，便于兼容：

- `keys`
- `config`
- `bgImage`
- `bgPosition`
- `bgScale`
- `bgKeyOpacity`
- `bgNonKeyOpacity`
- 可选 `meta`

## API 建议

- 新接口（推荐）：`/api/v1/...`
  - `POST /api/v1/configs` 使用 `{name, content, visibility}`
- 兼容接口（旧页面仍可用）：`/api/config*`

## 兼容原则

- 前端编辑器读写的配置内容结构不变
- 服务端在外围增加 `id/owner/visibility` 等业务字段
- 未来创意工坊、Fork、版本管理都基于外围字段扩展
