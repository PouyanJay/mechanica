# Contributing

## Setup

Node.js 22.13 or newer is required (see `.nvmrc`). From a fresh clone:

```sh
make run
```

That installs dependencies and starts the dev server on a free port. Run `make help` for every target.

## Before you open a pull request

| Change | Run |
| --- | --- |
| Engine geometry, motion, or separation | `make test-engines` |
| Rendering or shared UI | `make test-ui` |
| Anything executable | `make build` |
| Everything | `make test` and `make lint` |

CI runs the same commands on every push and pull request.

## Conventions

- Keep engine keys, component IDs, scene groups, and UI state in agreement. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).
- Derive piece poses from captured home transforms. Never accumulate per-frame offsets.
- Do not use em dashes or en dashes in UI copy or documentation. The engine check enforces this for the app.
- Describe geometry as educational reference models, not manufacturer CAD.
- Files under `components/ui/` are vendored from shadcn. Leave them intact and put project logic elsewhere.
- Commit messages: one imperative summary line, no trailers.
