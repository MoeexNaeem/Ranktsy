# Database space maintenance (one-time)

Three scripts that shrink the MongoDB database without changing anything users see.
Each runs in **preview mode** by default and only changes data with `--apply`.
Run them from the repo root, with `MONGODB_URI` in `.env.local` (or the environment).

A full verified backup taken before these changes is at
`C:\RankkwBackups\rankkwnew-2026-09-25-17-36` (mongorestore `--gzip` layout).

| Order | Script | When | Saves |
|---|---|---|---|
| 1 | `slim-collective.cjs` | any time | ~440 MB of data |
| 2 | `drop-unused-indexes.cjs` | **after** deploying the models.ts change | ~290 MB of indexes |
| 3 | `compact-snapshot-text.cjs` | **after** deploying the snapshots.ts change | ~1.4 GB of data |

```bash
node scripts/db-maintenance/slim-collective.cjs            # preview
node scripts/db-maintenance/slim-collective.cjs --apply    # change data
```

Freed space inside MongoDB's files is reused by new data, so growth stops for a long
time; Atlas's "disk used" figure may not drop until MongoDB compacts the files.
