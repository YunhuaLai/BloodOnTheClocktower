# BloodOnTheClocktower

血染钟楼百科 Web 原型，用于整理和展示剧本、角色、术语与笔记页相关资料。

## 项目结构

- `frontend/`：前端页面、样式和浏览器交互逻辑
- `backend/`：Node.js 后端服务与 API
- `backend/data/library/`：当前唯一主数据源
- `backend/data/library/scripts/*.yaml`：剧本数据
- `backend/data/library/roles/*.yaml`：角色数据
- `backend/data/library/roles/*.yaml` 中的 `abilityData`：角色技能结构化数据
- `backend/data/library/meta/role-ability-schema.yaml`：技能结构化数据 schema
- `backend/data/library/rules.yaml`：基础规则资料
- `backend/data/catalog/`：术语与少量运行时整理逻辑
- `scripts/`：项目辅助脚本

## 数据组织

当前数据采用“分目录 YAML 源文件”结构：

- 每个剧本一个 YAML 文件
- 每个角色一个 YAML 文件
- 每个角色的笔记页技能结构内嵌在对应角色文件的 `abilityData` 中
- 剧本 `id` 使用 `s001` 这类编号，原英文标识保存在 `englishName`
- 角色 `id` 使用 `r001` 这类编号，原英文标识保存在 `englishName`
- 文件名使用 `id-中文名.yaml`，方便人工整理；程序实际只依赖文件内容里的 `id`

## 本地运行

```bash
npm install
npm run build
npm start
```

`npm run build` 会把 YAML 资料预编译到忽略提交的 `dist/data/`。服务会优先读取这些构建产物；修改 YAML 后请重新运行构建。若构建产物不存在，服务仍会回退到直接读取 YAML。

打开：[http://localhost:3000](http://localhost:3000)

## 维护脚本

常用数据维护入口都在 `package.json` 的 `scripts` 中，完整脚本说明见 `scripts/README.md`。

```bash
npm run check
npm test
npm run build
npm run official:import -- "C:\path\官方剧本文件夹"
npm run official:export -- s001 ".\dist\暗流涌动.json"
npm run images:cache -- --kind=roles --limit=20 --dry-run
npm run setup-meta:refresh
```

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
- 运行时依赖 `js-yaml`，用于读取 YAML 数据文件
