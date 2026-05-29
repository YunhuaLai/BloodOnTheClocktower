# Scripts

`scripts/` 顶层只放可以直接运行的维护程序；共享 helper 放在 `scripts/lib/`。

命名约定：

- `check-*`：只检查，不写入文件。
- `validate-*`：加载项目数据并做结构校验。
- `sync-*`：默认 dry-run；加 `--write` 后把推断结果写回 YAML。
- `audit-*`：输出分析报告，不写入文件。
- `manage-*`：带子命令的导入/导出工具。
- `clean-*` / `dedupe-*` / `cache-*`：执行具体维护动作，通常支持 dry-run 或过滤参数。

## 常用命令

| 任务 | npm 命令 | 直接运行 |
| --- | --- | --- |
| 全量检查 JS 与数据 | `npm run check` | `node scripts/check-javascript.js && node scripts/validate-library-data.js` |
| 只检查 JS 语法 | `npm run check:js` | `node scripts/check-javascript.js` |
| 只校验资料库数据 | `npm run validate:data` | `node scripts/validate-library-data.js` |
| 导入官方 JSON | `npm run official:import -- <json或目录>` | `node scripts/manage-official-json.js import <json或目录>` |
| 导出官方 JSON | `npm run official:export -- <scriptId或名称> <输出文件>` | `node scripts/manage-official-json.js export <scriptId或名称> <输出文件>` |
| 缓存远程图片 | `npm run images:cache -- [参数]` | `node scripts/cache-library-images.js [参数]` |
| 检查技能术语 metadata | `npm run ability-terms:check` | `node scripts/sync-ability-terms.js` |
| 写入技能术语 metadata | `npm run ability-terms:sync` | `node scripts/sync-ability-terms.js --write` |
| 检查技能语义结构 | `npm run ability-semantics:check` | `node scripts/sync-ability-semantics.js` |
| 写入技能语义结构 | `npm run ability-semantics:sync` | `node scripts/sync-ability-semantics.js --write` |
| 检查推理画像 | `npm run deduction:check` | `node scripts/sync-deduction-profiles.js` |
| 写入推理画像 | `npm run deduction:sync` | `node scripts/sync-deduction-profiles.js --write` |
| 审计推理画像覆盖情况 | `npm run deduction:audit` | `node scripts/audit-deduction-profiles.js` |
| 检查 setupMeta | `npm run setup-meta:check` | `node scripts/sync-setup-meta.js` |
| 补写缺失 setupMeta | `npm run setup-meta:sync` | `node scripts/sync-setup-meta.js --write` |
| 刷新已有 setupMeta | `npm run setup-meta:refresh` | `node scripts/sync-setup-meta.js --write --refresh` |
| 检查重复角色能力 | `npm run roles:dedupe:check` | `node scripts/dedupe-role-abilities.js` |
| 合并重复角色引用 | `npm run roles:dedupe` | `node scripts/dedupe-role-abilities.js --write` |
| 检查英文标识 | `npm run roles:english-names:check` | `node scripts/clean-role-english-names.js` |
| 清理英文标识 | `npm run roles:english-names:clean` | `node scripts/clean-role-english-names.js --write` |

## 示例

```bash
npm run check
npm run official:import -- "C:\path\官方剧本文件夹"
npm run official:export -- s001 ".\dist\暗流涌动.json"
npm run images:cache -- --kind=roles --limit=20 --dry-run
npm run images:cache -- --kind=all --force
npm run setup-meta:refresh
```

## 图片缓存参数

`cache-library-images.js` 支持这些参数：

- `--dry-run`：只列出将要下载的图片。
- `--force`：已有缓存文件时也重新下载。
- `--kind=roles|scripts|all`：选择缓存角色、剧本或全部图片，默认是 `roles`。
- `--limit=<数量>`：限制本次处理数量。
- `--id=<id>`：只处理指定角色或剧本。

## 内部模块

- `lib/library-io.js`：共享路径和 YAML 读写。
- `lib/ability-term-metadata.js`：技能术语与模式推断。
- `lib/deduction-profile-inference.js`：笔记页推理画像推断。

新增可直接运行的维护程序时，放在 `scripts/` 顶层并补充 npm script；只有被两个以上命令复用的逻辑才放进 `scripts/lib/`。
