# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a monorepo containing Frakto's comprehensive coding standards and linting tools for multiple languages including JavaScript, TypeScript, PHP, HTML, CSS, JSON, and Markdown. The repository provides standardized formatting and linting configurations designed to be used by the Frakto Code Engine VS Code extension and other development tools.

## Architecture

The project follows a workspace-based monorepo structure with language-specific packages and a custom ESLint plugin:

### Root Structure

- **Main entry point**: Root `index.js` handles formatting/linting requests via JSON payload
- **Language-specific directories**: Each supported language has its own workspace
- **Custom ESLint plugin**: `packages/eslint-plugin-frakto/` contains custom rules

### Language Workspaces

- `js/` - JavaScript standards with ESLint configs and custom rules
- `ts/` - TypeScript standards with ESLint configs and custom rules
- `json/` - JSON standards with ESLint configs and custom rules
- `md/` - Markdown standards with formatting configurations
- `php/` - PHP standards with PHPCS rulesets and custom sniffs
- `html/` - HTML formatting utilities
- `css/` - CSS formatting and property ordering utilities
- `common/` - Shared utilities and configurations across languages

### Custom ESLint Plugin (`packages/eslint-plugin-frakto/`)

Contains 14 custom ESLint rules for enforcing Frakto coding standards:

**Docblock Rules:**

- `docblock-validate-params-js` - Validates JSDoc parameters for JavaScript
- `docblock-validate-params-ts` - Validates JSDoc parameters for TypeScript
- `docblock-validate-returns` - Validates @returns tags
- `docblock-validate-throws` - Validates @throws tags
- `docblock-validate-description` - Validates docblock descriptions
- `docblock-validate-spacing` - Enforces spacing in docblocks
- `docblock-validate-tag-order` - Enforces tag order in docblocks
- `docblock-no-examples` - Prevents @example tags
- `docblock-no-returns` - Prevents unnecessary @returns tags
- `require-docblock` - Requires docblocks on exports
- `no-orphaned-docblocks` - Prevents orphaned docblocks

**Code Style Rules:**

- `align-declarations` - Aligns variable declarations
- `no-block-comments` - Prevents block comments
- `separate-control-keywords` - Enforces spacing around control keywords

### PHP Standards

Multiple PHPCS rulesets for different contexts:

- `Frakto/` - Core PHP standards with custom sniffs
- `Frakto-PHP/` - Pure PHP projects
- `Frakto-Sniff/` - Sniff development
- `Frakto-WP/` - WordPress-specific standards

**Custom PHP Sniffs:**

- **Database Security**: PDO initialization, prepared statements, restricted functions/classes
- **Documentation**: Block comment formatting, parameter docs, return docs
- **Code Style**: Array spacing, closing tags, exit/die formatting, emoji prevention

## Common Commands

### Development Setup

```bash
# Install all dependencies
npm install

# Install PHP dependencies
composer install
```

### Main Tool Usage

```bash
# Format/lint via environment variable
FRAKTO_PAYLOAD='{"language":"javascript","mode":"both","content":"..."}' node index.js
```

### Language-Specific Testing

```bash
# Test JavaScript formatting
cd js && node index.js

# Test TypeScript formatting
cd ts && node index.js

# Test JSON formatting
cd json && node index.js

# Test Markdown formatting
cd md && node index.js

# Test PHP formatting
cd php && node index.js

# Test HTML formatting
cd html && node index.js
```

### PHP Standards Usage

```bash
# Check with core Frakto standard
vendor/bin/phpcs --standard=Frakto file.php

# Check with WordPress standard
vendor/bin/phpcs --standard=Frakto-WP file.php

# Auto-fix violations
vendor/bin/phpcbf --standard=Frakto file.php
```

### ESLint Plugin Testing

```bash
# Test custom rules
cd packages/eslint-plugin-frakto
npm test  # if tests exist
```

## Configuration Files

### ESLint Configurations

- `js/eslint.config.js` - JavaScript ESLint config with Frakto rules
- `ts/eslint.config.js` - TypeScript ESLint config with Frakto rules
- `json/eslint.config.js` - JSON ESLint config
- `packages/eslint-plugin-frakto/index.js` - Custom plugin export

### Prettier Configurations

- `js/prettier.config.js` - JavaScript/general Prettier config
- `ts/prettier.config.js` - TypeScript Prettier config
- `json/prettier.config.js` - JSON Prettier config
- `md/prettier.config.js` - Markdown Prettier config
- `html/prettier.config.js` - HTML Prettier config

### PHP Standards

- `php/package/Frakto/ruleset.xml` - Core PHP standards
- `php/package/Frakto-PHP/ruleset.xml` - Pure PHP standards
- `php/package/Frakto-WP/ruleset.xml` - WordPress standards
- `php/package/Frakto-Sniff/ruleset.xml` - Sniff development standards

## API Interface

### Input Payload (via `FRAKTO_PAYLOAD` environment variable)

```json
{
  "language": "javascript|typescript|php|html|css|json|markdown",
  "mode": "format|lint|both",
  "content": "source code content",
  "linterStandard": "optional standard name"
}
```

### Output Response

```json
{
  "formatted": "formatted code or null",
  "diagnostics": "array of lint issues or null",
  "debug": "debug information or null"
}
```

## Development Guidelines

### Commit Message Format

Follow conventional format: `type: description`

**Allowed types**: feat, fix, chore, docs, style, refactor, test, perf, build, ci, revert, wip, release

### Code Standards

- All JavaScript/TypeScript must pass custom Frakto ESLint rules
- PHP code must pass PHPCS with appropriate Frakto standard
- Maintain consistent formatting across all language workspaces
- Follow existing patterns when adding new rules or sniffs

### Testing New Rules

- Test custom ESLint rules in `packages/eslint-plugin-frakto/`
- Test PHP sniffs with appropriate sample files
- Verify integration with main tool via payload testing

## Important Notes

- This is a monorepo using npm workspaces for JavaScript packages
- PHP tools require `composer install` for PHPCS dependencies
- Custom ESLint rules are in `packages/eslint-plugin-frakto/rules/`
- Custom PHP sniffs are in `php/package/Frakto/Sniffs/`
- Each language workspace operates independently but shares common utilities
- All formatting/linting is accessible through the unified JSON payload interface
