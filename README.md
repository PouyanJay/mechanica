# Mechanica

Interactive 3D exploration of seven parametric engines: turbofan, turbojet, turboprop, turboshaft, V8, inline-four, and rotary. Inspect components, reveal cutaways, animate mechanisms, and scrub continuously from a complete assembly to individual pieces.

All geometry is generated in TypeScript with Three.js. No API key, database, or cloud account is needed to run it locally.

## Quick start

Requires Node.js 22.13 or newer (see `.nvmrc`) and a browser with WebGL2.

```sh
make run
```

This installs dependencies, starts the dev server on a free port, and prints the URL. Run `make help` for the full command reference, or use npm directly:

| Command | Purpose |
| --- | --- |
| `npm run dev:local` | Local development with hot reload |
| `npm run build:local` | Compile browser assets and the Cloudflare Worker into `dist/` |
| `npm run start:local` | Serve a production build locally |
| `npm run test:engines` | Numeric checks for all seven models, disassembly, and mechanisms |
| `npm run test:local` | Build, then rendered-HTML and UI component tests |
| `npm run lint` | ESLint |

The app is a React application served by Vinext (Next.js app router on Vite) with a Cloudflare Worker entry. Use its server rather than opening source files directly.

## Explore

- Choose an engine from the picker.
- Select, hide, or isolate component groups or individual pieces.
- Drag **Explode engine** between **Assembled** and **Every piece**.
- Choose Inventory or Radial layout, adjust spacing, or play the reversible loop.
- Use cutaway and mechanism animation. Flow is available for turbine engines.

These are original educational reference models, not manufacturer CAD or service instructions. Motion illustrates mechanism relationships, not a calibrated thermodynamic or structural simulation.

## Project layout

```
app/                  Routes, root layout, and global styles
components/
  engine/             Three.js scene component: builders, lighting, cameras, picking
  ui/                 Vendored shadcn primitives (do not edit)
lib/
  engine/             Engine catalog, mechanical builders, separation controller, packing
  utils.ts
hooks/                Shared React hooks
worker/               Cloudflare Worker entry
tooling/              Vite build plugins
scripts/              Makefile targets, install and run helpers, engine checks
tests/                Rendered-HTML and UI component tests
docs/                 Architecture and handoff notes
public/               Static assets
vendor/               Bundled shadcn stylesheet with its license
```

| Module | Responsibility |
| --- | --- |
| `app/page.tsx` | UI, selection, state, and controls |
| `lib/engine/engine-data.ts` | Engine registry and component descriptions |
| `components/engine/engine-scene.tsx` | Scene graph, turbine builders, lighting, cameras, picking |
| `lib/engine/mechanical-engines.ts` | Piston, rotary, and shaft-output geometry and motion |
| `lib/engine/explosion-controller.ts` | Piece identity, poses, visibility, selection, camera fitting |
| `lib/engine/explosion-layout.ts` | Inventory shelf packing |
| `scripts/check-explosion.mjs` | Numeric checks against the real model builders |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data flow, separation contract, mechanism constraints, and how to add an engine. See [CONTRIBUTING.md](CONTRIBUTING.md) for the verification checklist.

## Hosting

`.openai/hosting.json` declares optional D1 and R2 bindings for Sites hosting and is imported by `vite.config.ts`, so keep it in place even when both values are null. Other hosts need a compatible Worker deployment.

To produce a source-only archive of the current commit:

```sh
python3 scripts/export-repository.py /absolute/path/mechanica-source.zip
```

## License

MIT. See [LICENSE](LICENSE). Third-party packages keep their own licenses; `vendor/shadcn-tailwind-4.13.0.LICENSE.md` must stay with its stylesheet.
