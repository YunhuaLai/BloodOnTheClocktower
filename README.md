# BloodOnTheClocktower

血染钟楼百科 Web 原型，用于整理和展示游戏相关资料，包括角色、术语与剧本内容，并提供基础浏览与查询能力。

项目目前采用轻量的前后端结构：

- `frontend/` 负责页面展示、样式和浏览器交互
- `backend/` 负责提供 API，并托管前端静态文件
- `backend/data/encyclopedia.json` 保存当前百科资料数据

## 项目目标

- 以网页形式集中展示血染钟楼资料
- 为后续的搜索、筛选、导航和内容扩展提供基础结构
- 保持实现简单，方便快速迭代和验证想法

## 目录结构

- `frontend/`: 前端页面、样式和浏览器交互逻辑
- `backend/`: Node 后端服务
- `backend/data/encyclopedia.json`: 当前百科资料数据
- `scripts/`: 项目辅助脚本
- `package.json`: 本地运行脚本

## 本地运行

```bash
npm start
```

打开：`http://localhost:3000`

## API

- `GET /api/health`: 服务健康检查
- `GET /api/encyclopedia`: 返回游戏速览、板子和角色资料
- `GET /api/scripts`: 返回剧本列表
- `GET /api/scripts/:id`: 返回指定剧本详情
- `GET /api/roles`: 返回角色列表
- `GET /api/roles/:id`: 返回指定角色详情
- `GET /api/terms`: 返回术语列表
- `GET /api/terms/:id`: 返回指定术语详情

## 技术说明

- 后端使用 Node.js 原生 `http` 模块
- 前端当前使用原生 HTML、CSS 和 JavaScript
- 当前没有引入第三方运行时依赖，安装 Node.js 后即可运行
