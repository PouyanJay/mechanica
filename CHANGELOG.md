# Changelog

All notable changes to Mechanica are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-09-08

First public release.

### Added

- Seven original parametric engines: turbofan, turbojet, turboprop, turboshaft, V8, inline-four and Wankel rotary.
- Assembled, cutaway and explore modes with a continuous, reversible separation slider from full assembly to every independent piece.
- Inventory shelf and radial layouts with adjustable spacing and a separation cycle.
- Component and single-piece selection, hiding and isolation, with smart callout labels that pick their contrast from the pixels behind them.
- Schematic airflow streaklines for the turbine engines.
- Perspective, orthographic, side and front cameras, floor grid, auto-rotate, and dark and light themes.
- Numeric engine checks covering piece identity, non-overlapping layouts, reverse-scrub determinism, exact reassembly and mechanism constraints.
- Makefile workflow (`make run`, `make test`, `make lint`), GitHub Actions CI, and Vercel deployment.

[0.1.0]: https://github.com/PouyanJay/mechanica/releases/tag/v0.1.0
