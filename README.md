# BloodOnTheClocktower

血染钟楼百科 Web 原型。

## 目录结构

- `frontend/`: 前端页面、样式和浏览器交互逻辑
- `backend/`: Node 后端服务
- `backend/data/encyclopedia.json`: 当前百科资料数据
- `package.json`: 本地运行脚本

## 本地运行

```bash
npm start
```

打开：`http://localhost:3000`

## Render 部署

项目已经包含 [render.yaml](C:/Users/laiyu/OneDrive/Documents/血染钟楼/render.yaml)，可以直接用于 Render 测试部署。

### 方式 1：用 Blueprint

1. 把当前分支推到 GitHub
2. 在 Render 里选择 `New +` -> `Blueprint`
3. 连接这个仓库
4. 选择分支 `render-deploy-test`
5. 确认创建 Web Service

Render 会按下面的配置部署：

- `buildCommand`: `npm install`
- `startCommand`: `npm start`
- `plan`: `free`

### 方式 2：手动创建 Web Service

1. 在 Render 里选择 `New +` -> `Web Service`
2. 连接 GitHub 仓库并选中分支 `render-deploy-test`
3. 环境选择 `Node`
4. Build Command 填 `npm install`
5. Start Command 填 `npm start`

### 部署说明

- 服务默认监听 `process.env.PORT`，本地默认为 `3000`
- 首页由 `frontend/` 提供静态文件
- API 入口包括 `GET /api/health` 和 `GET /api/encyclopedia`

## API

- `GET /api/health`: 服务健康检查
- `GET /api/encyclopedia`: 游戏速览、板子和角色资料

现在没有引入第三方依赖，安装 Node.js 后即可运行。
