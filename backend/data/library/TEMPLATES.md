# 数据模板

新增剧本和角色时，可以直接复制这些模板：

- `scripts/s000-剧本模板.yaml`
- `roles/r000-角色模板.yaml`
- `role-abilities/r000-角色模板.yaml`

建议流程：

1. 复制剧本模板，改成新的 `sxxx-中文名.yaml`
2. 填写剧本 `id`、`englishName`、`name` 和 `roleIds`
3. 复制角色模板，改成新的 `rxxx-中文名.yaml`
4. 让角色里的 `scriptId` / `scriptIds` 指向对应剧本
5. 如果这个角色需要笔记页结构化记录，再复制 `role-abilities` 模板

注意：

- 程序实际依赖的是文件内容里的 `id`，不是文件名
- `id` 要保持唯一
- `englishName` 建议保持英文稳定标识，后续不要频繁改
- `roleIds`、`scriptId`、`relatedRoleIds` 这些关联字段都使用编号 id
