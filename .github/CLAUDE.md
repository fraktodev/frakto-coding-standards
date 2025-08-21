# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing Frakto's coding standards and linting tools for multiple languages (JavaScript/TypeScript, PHP, HTML, CSS). The repository provides standardized formatting and linting configurations that can be used by the Frakto Code Engine VS Code extension.

## Architecture

The project is structured as a Node.js workspace with language-specific packages:

- **Root level**: Main entry point (`index.js`) that handles formatting/linting requests via JSON payload
- **Workspaces**: Each language has its own package in separate directories:
  - `js/` - JavaScript/TypeScript standards with ESLint configs and custom rules
  - `php/` - PHP standards with PHPCS rulesets and custom sniffs
  - `html/` - HTML formatting utilities
  - `css/` - CSS formatting and ordering utilities
  - `common/` - Shared utilities across languages

### Key Components

- **Main processor** (`index.js`): Receives `FRAKTO_PAYLOAD` environment variable, determines formatter/linter based on language, and returns structured response
- **Language processors**: Each workspace has an `index.js` that handles language-specific formatting/linting
- **Custom rules**: JavaScript package includes custom ESLint rules for docblock formatting
- **PHP sniffs**: Custom PHPCS sniffs for database security, documentation standards, and code style

## Common Commands

### Development
```bash
# Install dependencies for all workspaces
npm install

# Install PHP dependencies
composer install
```

### Running the Main Tool
The main tool expects a JSON payload via environment variable:
```bash
FRAKTO_PAYLOAD='{"language":"javascript","mode":"both","content":"..."}' node index.js
```

### Testing Individual Language Tools
```bash
# Test JavaScript/TypeScript formatting
cd js && node index.js

# Test PHP formatting (requires composer install)
cd php && node index.js

# Test HTML formatting
cd html && node index.js
```

### PHP Code Standards
```bash
# Run PHPCS with Frakto standards
vendor/bin/phpcs --standard=Frakto file.php

# Fix code with PHPCBF
vendor/bin/phpcbf --standard=Frakto file.php
```

## Configuration Files

- **ESLint**: `js/eslint.config.js` - Main ESLint configuration using Frakto custom rules
- **PHP Standards**: `php/package/Frakto/ruleset.xml` - Main PHPCS ruleset
- **Prettier**: Each workspace has its own `prettier.config.js`

## Payload Format

The main tool expects this JSON structure via `FRAKTO_PAYLOAD`:
```json
{
  "language": "javascript|typescript|php|html|css",
  "mode": "format|lint|both",
  "content": "source code content",
  "linterStandard": "optional standard name"
}
```

Returns:
```json
{
  "formatted": "formatted code or null",
  "diagnostics": "array of lint issues or null",
  "debug": "debug info or null"
}
```

## Commit Message Format

Follow lowercase format: `type: description`

Allowed types: feat, fix, chore, docs, style, refactor, test, perf, build, ci, revert, wip, release

## Important Notes

- This is a monorepo using npm workspaces
- PHP tools require `composer install` to be run
- Custom ESLint rules are in `js/package/rules/`
- Custom PHP sniffs are in `php/package/Frakto/Sniffs/`
- Each language package is designed to work independently but shares common utilities