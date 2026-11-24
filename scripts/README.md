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
| 构建运行时资料缓存 | `npm run build` | `node scripts/build-library-data.js` |
| 全量检查 JS、测试与数据 | `npm run check` | `npm run check:js && npm test && npm run validate:data` |
| 只检查 JS 语法 | `npm run check:js` | `node scripts/check-javascript.js` |
| 只校验资料库数据 | `npm run validate:data` | `node scripts/validate-library-data.js` |
| 导入官方 JSON | `npm run official:import -- <json或目录>` | `node scripts/manage-official-json.js import <json或目录>` |
| 导出官方 JSON | `npm run official:export -- <scriptId或名称> <输出文件>` | `node scripts/manage-official-json.js export <scriptId或名称> <输出文件>` |
| 缓存远程图片 | `npm run images:cache -- [参数]` | `node scripts/cache-library-images.js [参数]` |
| 检查技能术语 metadata | `npm run ability-terms:check` | `node scripts/sync-ability-terms.js` |
| 写入技能术语 metadata | `npm run ability-terms:sync` | `node scripts/sync-ability-terms.js --write` |
| 检查技能语义结构 | `npm run ability-semantics:check` | `node scripts/sync-ability-semantics.js` |
| 写入技能语义结构 | `npm run ability-semantics:sync` | `node scripts/sync-ability-semantics.js --write` |
| 检查重新生成未审核角色的能力数据 | `npm run ability-generate:check` | `node scripts/sync-generated-ability-data.js` |
| 重新生成未审核角色的能力数据 | `npm run ability-generate:sync` | `node scripts/sync-generated-ability-data.js --write` |
| 检查座位过滤（seatFilter） | `npm run seat-filters:check` | `node scripts/sync-seat-filters.js` |
| 写入座位过滤（已审核角色需加 `--include-reviewed`） | `npm run seat-filters:sync` | `node scripts/sync-seat-filters.js --write` |
| 检查推理画像 | `npm run deduction:check` | `node scripts/sync-deduction-profiles.js` |
| 写入推理画像 | `npm run deduction:sync` | `node scripts/sync-deduction-profiles.js --write` |
| 审计推理画像覆盖情况 | `npm run deduction:audit` | `node scripts/audit-deduction-profiles.js` |
| 按剧本收录数审计能力数据审核进度 | `npm run ability-review:audit -- [--script=s001]` | `node scripts/audit-ability-review.js [--script=s001]` |
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
npm run ability-review:audit -- --script=s001,s002,s003
```

## 能力数据审核报告参数

`audit-ability-review.js` 只读 YAML，按“被多少个剧本收录”给角色排序，列出 `reviewStatus`、`confidence`、可记录但无字段、自由文本字段、泛泛的字段标签、推理状态，以及审核后原文是否又变了。报告写到 `tmp/ability-review-audit[-剧本id].md` 和 `.json`。

- `--script=<id>[,<id>]`：只看这些剧本收录的角色（含旅行者、传奇角色）。
- `--status=<状态>[,<状态>]`：只看某些审核状态，例如 `needs_review,source_changed`。
- `--all`：不按剧本过滤时也列出未被任何剧本收录的角色。
- `--limit=<数量>`：控制台打印的明细条数；报告文件始终包含全部。

已审核（`reviewStatus: reviewed`）的角色由 `abilitySemantics.review` 记录审核者和日期；`sync-*` 脚本不会改写它们的 `abilityPattern` 和 `deduction`，只会刷新 `termIds`。

## 重新生成能力数据

`sync-generated-ability-data.js` 用 `lib/ability-generator.js`（导入官方 JSON 也用它）按当前技能原文重新生成能力数据：笔记页字段、时机、语义、推理画像。生成器按句（。；）和分句（，：）读原文，只把角色自己的选择和得知算作字段（「任何…选择你的玩家」「所有玩家都知道」不算），再按「得知」后面的内容判断字段类型。

只处理仍是生成器原样输出的角色：未审核、`generatedFromOfficial: true`、所有字段的 key / 类型 / 标签都是生成器会写的。手工改过字段或标签的角色会被跳过并列出。报告写到 `tmp/generated-ability-data.md`。

- `--id=<id>[,<id>]`：只处理这些角色。

## 图片缓存参数

`cache-library-images.js` 支持这些参数：

- `--dry-run`：只列出将要下载的图片。
- `--force`：已有缓存文件时也重新下载。
- `--kind=roles|scripts|all`：选择缓存角色、剧本或全部图片，默认是 `roles`。
- `--limit=<数量>`：限制本次处理数量。
- `--id=<id>`：只处理指定角色或剧本。

## 内部模块

- `lib/library-io.js`：共享路径和 YAML 读写。
- `lib/ability-generator.js`：从技能原文生成 abilityData（导入与重新生成共用）。
- `lib/ability-term-metadata.js`：技能术语与模式推断。
- `lib/deduction-profile-inference.js`：笔记页推理画像推断。
- `lib/ability-review.js`：审核状态判断、源文本 hash、审核报告用的字段检查。

新增可直接运行的维护程序时，放在 `scripts/` 顶层并补充 npm script；只有被两个以上命令复用的逻辑才放进 `scripts/lib/`。
