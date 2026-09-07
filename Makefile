# Mechanica Makefile
#
# Thin dispatcher only: every target is a one-liner that invokes a script in
# scripts/. Logic lives there; see scripts/lib/ui.sh for the shared output
# library. Run `make help` (or just `make`) for the command reference.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# ── Help ─────────────────────────────────────────────────────────────────────
.PHONY: help

help:
	@./scripts/help.sh

# ── Setup & Run ──────────────────────────────────────────────────────────────
.PHONY: setup start run stop logs

setup:
	@./scripts/install.sh

start:
	@./scripts/run.sh

# `make run` is the bulletproof end-to-end target: install everything from a
# fresh clone + start the dev server, health-gated, URL printed at the end.
# The one command a contributor needs.
run: setup start

stop:
	@./scripts/run.sh --stop

logs:
	@./scripts/run.sh --logs

# ── Build ────────────────────────────────────────────────────────────────────
.PHONY: build

build:
	@./scripts/build.sh

# ── Testing ──────────────────────────────────────────────────────────────────
.PHONY: test test-engines test-ui

test:
	@./scripts/run-tests.sh --all

test-engines:
	@./scripts/run-tests.sh --engines

test-ui:
	@./scripts/run-tests.sh --ui

# ── Linting ──────────────────────────────────────────────────────────────────
.PHONY: lint lint-fix

lint:
	@./scripts/run-linters.sh

lint-fix:
	@./scripts/run-linters.sh --fix

# ── Housekeeping ─────────────────────────────────────────────────────────────
.PHONY: clean

clean:
	@./scripts/run.sh --clean
