# BloodOnTheClocktower

血染钟楼百科 Web 原型。

## 目录结构

- `frontend/`: 前端页面、样式和浏览器交互逻辑
- `backend/`: Node 后端服务
- `backend/data/encyclopedia.json`: 当前百科资料数据
- `backend/data/catalog/role-ability-schema.js`: 角色技能结构化分类 schema v1 草案与样例
- `backend/data/catalog/role-ability-data.js`: 按角色 id 维护的技能结构化数据映射
- `package.json`: 本地运行脚本

## 本地运行

```bash
npm start
```

打开：`http://localhost:3000`

## API

- `GET /api/health`: 服务健康检查
- `GET /api/encyclopedia`: 游戏速览、板子和角色资料

现在没有引入第三方依赖，安装 Node.js 后即可运行。
