# AGENTS.md

## Cursor Cloud specific instructions

### Overview

ESPHome is a Python-based IoT firmware configuration system. It parses YAML configs, generates C++ code, and compiles firmware via PlatformIO. No external services (databases, message brokers) are required for development.

### Running Services

- **ESPHome CLI**: `source venv/bin/activate && esphome <command>` (e.g., `esphome config`, `esphome compile`)
- **Dashboard**: `source venv/bin/activate && esphome dashboard .temp/ --port 6052` — web UI on port 6052
- The `host` platform allows compiling and running firmware as a native binary without physical hardware

### Lint / Test / Build

All commands require the venv: `source venv/bin/activate`

- **Lint (ruff)**: `ruff check esphome/`
- **Lint (flake8)**: `flake8 esphome/`
- **Unit tests**: `pytest tests/unit_tests/ --no-cov`
- **Component tests**: `pytest tests/component_tests/ --no-cov`
- **Config validation**: `esphome config <file>.yaml`
- **Compile**: `esphome compile <file>.yaml`
- **Full test suite**: see `script/fulltest`, `script/test`, `script/unit_test`, `script/component_test`
- **Pre-commit**: `pre-commit run --all-files`

### Gotchas

- `python3.12-venv` system package is required but not installed by default in Ubuntu 24.04 — the update script handles this.
- If `core.hooksPath` is set in git config, `pre-commit install` will fail. Run `git config --unset-all core.hooksPath` first.
- The `esphome compile` command for `host` platform requires `gcc`/`g++` (system C/C++ toolchain).
- PlatformIO downloads toolchains on first compile for non-host platforms; this can take several minutes.
- Integration tests (`tests/integration/`) compile YAML and run native binaries — these take longer than unit/component tests.
- `--no-cov` flag is recommended for local test runs to avoid coverage overhead; coverage is configured by default in `pyproject.toml`.
