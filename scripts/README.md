# Scripts

`scripts/` keeps user-facing maintenance commands at the top level. Shared helper modules live in `scripts/lib/` and should not read `process.argv` or write files as a side effect when they are imported.

## Commands

- `check-js.js`: syntax-check backend, frontend, and maintenance JavaScript.
- `validate-data.js`: validate the YAML library after loading the backend catalog.
- `official-json.js`: import or export official Blood on the Clocktower JSON files.
- `cache-images.js`: download remote image assets into `frontend/assets`.
- `backfill-ability-terms.js`: infer `abilityData.termIds` and `abilityPattern`.
- `backfill-deduction-profiles.js`: infer note-page deduction profiles.
- `deduction-profile-audit.js`: summarize supported and unsupported deduction profiles.
- `backfill-setup-meta.js`: infer setup metadata from role abilities.
- `dedupe-roles-by-ability.js`: find duplicate role definitions by normalized ability text.
- `clean-english-names.js`: replace generated or invalid `englishName` values.

## Internal Modules

- `lib/library-io.js`: shared paths plus YAML read/write helpers.
- `lib/ability-term-metadata.js`: ability term and pattern inference.
- `lib/deduction-profile-inference.js`: deduction profile inference.

Add an npm script when a maintenance command is meant to be run directly. Move reusable logic into `lib/` only when at least two commands need it.
