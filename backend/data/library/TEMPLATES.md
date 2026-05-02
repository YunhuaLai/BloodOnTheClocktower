# 数据模板

新增剧本和角色时，可以直接复制这些模板：

- `scripts/s000-剧本模板.yaml`
- `roles/r000-角色模板.yaml`
- `role-abilities/r000-角色模板.yaml`

建议流程：

1. 复制剧本模板，改成新的 `sxxx-中文名.yaml`
2. 填写剧本 `id`、`englishName`、`name`、官方导入/导出字段和 `roleIds`
3. 复制角色模板，改成新的 `rxxx-中文名.yaml`
4. 填写角色自身字段，不要在角色里维护所属剧本
5. 如果这个角色需要笔记页结构化记录，再复制 `role-abilities` 模板

官方 JSON 导入/导出约定：

- 单文件导入：`npm run official:import -- "C:\path\#暗流涌动.json"`
- 文件夹批量导入：`npm run official:import -- "C:\path\官方剧本文件夹"`，会递归导入所有子文件夹中的 `.json`
- 导出官方格式：`npm run official:export -- s001 ".\dist\暗流涌动.json"`
- `roleIds` 只维护常规剧本角色：`townsfolk`、`outsider`、`minion`、`demon`
- 旅行者维护在 `travellerIds` 中；传奇角色维护在 `fabledIds` 中
- 后端会从 `roleIds` 反向派生普通角色的 `scriptIds`、`scriptNames`、`script` 和 `scriptId`
- `scripts` 中的 `author`、`logo`、`description`、`townsfolkName`、`additional` 对应官方 JSON 的 `_meta`
- `scripts.nightOrder.first` 和 `scripts.nightOrder.other` 使用角色 id 的有序数组；导出官方 JSON 时由它们生成角色的 `firstNight` / `otherNight` 数字
- `roles` 中的 `edition`、`image`、`flavor`、`setup`、`reminders`、`remindersGlobal`、`firstNightReminder`、`otherNightReminder` 对应官方角色对象字段
- `roles.setupMeta` 是本站说书人/随机分配用字段，不导出到官方 JSON
- `setupMeta.randomAssignable: false` 表示不能直接随机分配该角色标记，例如酒鬼、提线木偶
- `setupMeta.identityOverlay` 用于身份覆盖类角色：实际身份由说书人记录，玩家拿到另一个角色标记
- `setupMeta.configurationAdjustments` 用于配置调整类角色，例如 `[-1或+1外来者]`；`setupAlertLevel: danger` 可在说书人模式中标红提示
- 导出官方 JSON 时，角色对象的 `id` 可以直接使用本站角色 id；不需要单独维护官方 `sourceId`
- 官方 JSON 中的旅行者会导入到 `travellerIds`，传奇角色会导入到 `fabledIds`
- 导出官方 JSON 时顺序为 `_meta`、旅行者、常规剧本角色、传奇角色
- 自动生成 `role-abilities` 时会优先生成结构化字段，如目标号码、选择角色、数字结果、是否结果、身份结果、阵营结果；复杂角色会标记 `needsReview: true`
- `role-abilities` 是本站笔记页交互结构。官方 JSON 只能半自动生成初稿，复杂角色应标记 `needsReview: true`

注意：

- 程序实际依赖的是文件内容里的 `id`，不是文件名
- `id` 要保持唯一
- `englishName` 建议保持英文稳定标识，后续不要频繁改
- `roleIds`、`nightOrder`、`relatedRoleIds` 这些关联字段都使用编号 id
- 角色文件不再存放 `script`、`scriptId`、`scriptIds` 或 `scriptNames`
