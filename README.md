# BloodOnTheClocktower

血染钟楼百科 Web 原型，用于整理和展示游戏相关资料，包括剧本、角色与术语，并提供基础浏览与查询能力。

## 项目结构

- `frontend/`：前端页面、样式和浏览器交互逻辑
- `backend/`：Node.js 后端服务与 API
- `backend/data/library/`：当前运行时使用的数据源
- `backend/data/library/scripts/*.yaml`：按剧本拆分的 YAML 文件
- `backend/data/library/roles/*.yaml`：按角色拆分的 YAML 文件
- `backend/data/library/role-abilities/*.yaml`：按角色拆分的技能结构化数据
- `backend/data/library/meta/role-ability-schema.yaml`：技能结构化数据 schema
- `backend/data/library/rules.yaml`：基础规则资料
- `backend/data/catalog/`：术语与少量运行时整理逻辑
- `scripts/`：项目辅助脚本

## 数据组织

当前数据采用“分目录 YAML 源文件”结构：

- 每个剧本一个 YAML 文件，方便独立维护与扩展
- 每个角色一个 YAML 文件，便于后续增加大量角色
- 每个角色的笔记页技能结构单独放在 `role-abilities/`
- 后端启动时会读取这些 YAML 文件，并继续通过原有 API 对外提供统一 JSON
- 剧本 `id` 使用 `s001` 这类编号，原英文标识保存在 `englishName`
- 角色 `id` 使用 `r001` 这类编号，原英文标识保存在 `englishName`
- 文件名使用 `id-中文名.yaml`，便于人工整理；程序实际只依赖文件内容里的 `id`

历史文件 `backend/data/encyclopedia.json` 目前仅保留为迁移来源，不再作为运行时主数据源。

## 本地运行

```bash
npm install
npm start
```

打开：[http://localhost:3000](http://localhost:3000)

## 数据迁移

如果你之后还想把旧的 `encyclopedia.json` 再次拆分成 YAML，可以运行：

```bash
npm run migrate:data
```

如果你想重新规范 `library` 中的文件名，可以运行：

```bash
npm run rebuild:library
```

这个脚本会按 `id-中文名.yaml` 规则重写：

- `backend/data/library/scripts/*.yaml`
- `backend/data/library/roles/*.yaml`
- `backend/data/library/role-abilities/*.yaml`

## API

- `GET /api/health`：服务健康检查
- `GET /api/encyclopedia`：返回百科总数据
- `GET /api/scripts`：返回剧本列表
- `GET /api/scripts/:id`：返回指定剧本详情
- `GET /api/roles`：返回角色列表
- `GET /api/roles/:id`：返回指定角色详情
- `GET /api/terms`：返回术语列表
- `GET /api/terms/:id`：返回指定术语详情

## 技术说明

- 后端使用 Node.js 原生 `http` 模块
- 前端使用原生 HTML、CSS 和 JavaScript
- 新增运行时依赖 `js-yaml`，用于读取 YAML 数据文件
