# One definition of the gate.
#
# Everything below runs the same on this machine and in CI, because CI calls
# these targets rather than restating them. A pipeline that spells the checks
# out a second time drifts from the first on the day somebody adds a step to
# only one of them, and nobody notices until the thing it was guarding breaks.

BUN  := bun
WEB  := $(BUN) run --cwd web
COV  := /tmp/bancada-cov

.DEFAULT_GOAL := help
.PHONY: help check rust web arch text fmt lint test cover clean sweep

help:  ## What each target does
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

check: rust web arch  ## Everything, the way CI runs it

# ── rust ─────────────────────────────────────────────────────────────────
rust: ## Format, lint, test and cover the Rust side
	cargo fmt --all --check
	cargo clippy --workspace --all-targets -- -D warnings
	cargo test --workspace
	@$(MAKE) --no-print-directory cover-rust

cover-rust:
	@mkdir -p $(COV)
	cargo llvm-cov --workspace --lcov --output-path $(COV)/rust.info \
		--ignore-filename-regex 'bancada-testing'
	@python3 tools/coverage-gate.py $(COV)/rust.info

# ── web ──────────────────────────────────────────────────────────────────
web: ## Lint, typecheck, test, cover and check the phrases
	$(WEB) lint
	cd web && bunx tsc --noEmit -p .
	$(WEB) text:check
	@$(MAKE) --no-print-directory cover-web

cover-web:
	cd web && bunx vitest run --coverage
	@python3 tools/coverage-gate.py web:web/coverage/lcov.info

# ── the architecture ─────────────────────────────────────────────────────
# Pinned like every other dependency (ADR-013). `@latest` in a gate means the
# gate can change without anybody committing anything, and the day it does the
# failure looks like the code's fault.
ARCHWARDEN := archwarden@0.35.0

arch: ## Do the rules hold, and do they still reach anything
	bunx --bun $(ARCHWARDEN) check
	bunx --bun $(ARCHWARDEN) config doctor

# ── the pieces, on their own ─────────────────────────────────────────────
fmt: ## Format everything in place
	cargo fmt --all
	$(WEB) lint:fix

lint: ## Just the linters
	cargo clippy --workspace --all-targets -- -D warnings
	$(WEB) lint

test: ## Just the tests
	cargo test --workspace
	$(WEB) test

text: ## Is every phrase accounted for
	$(WEB) text:check

cover: cover-rust cover-web  ## Coverage, held to the floors in tools/coverage-gate.py

# ── the disk ─────────────────────────────────────────────────────────────
clean: ## Build output and coverage, keeping the dependencies
	rm -rf target/debug target/release web/dist web/coverage tools/__pycache__ web/tsconfig.tsbuildinfo $(COV)

sweep: clean ## Everything that can be rebuilt, including the dependencies
	@echo "before: $$(du -sh target web/node_modules app/node_modules 2>/dev/null | tr '\n' ' ')"
	rm -rf target web/node_modules app/node_modules
	@echo "run 'bun install --cwd web && bun install --cwd app' before building again"
