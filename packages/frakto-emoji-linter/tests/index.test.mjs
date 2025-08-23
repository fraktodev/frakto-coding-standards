// Dependencies
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import fraktoEmojiLinter from '../index.mjs';

// Declarations
const fileName = fileURLToPath(import.meta.url);
const dirName  = path.dirname(fileName);
const linter   = new fraktoEmojiLinter({ whitelist: ['©'] });

// Tests
describe('frakto-emoji-linter', () => {
	describe('fraktoEmojiLinter.detectEmojis', () => {
		it('should detect emojis in a string', () => {
			const content = 'Hello 😀 world 🌍!';
			const result  = linter.detectEmojis(content);

			expect(result).toHaveLength(2);
			expect(result[0].emoji).toBe('😀');
			expect(result[0].line).toBe(1);
			expect(result[0].column).toBe(7);
			expect(result[0].message).toBe('Emoji usage detected - emojis are not allowed in code');
			expect(result[0].severity).toBe('error');
			expect(result[1].emoji).toBe('🌍');
		});

		it('should return empty array for string without emojis', () => {
			const content = 'Hello world!';
			const result  = linter.detectEmojis(content);

			expect(result).toHaveLength(0);
		});

		it('should detect complex emojis', () => {
			const content = 'Family 👨‍👩‍👧‍👦 and flag 🏴‍☠️';
			const result  = linter.detectEmojis(content);

			expect(result.length).toBeGreaterThan(0);
			expect(result.some((match) => match.emoji.includes('👨'))).toBe(true);
		});

		it('should handle empty string', () => {
			const result = linter.detectEmojis('');
			expect(result).toHaveLength(0);
		});

		it('should handle multiline strings', () => {
			const content = 'Line 1 😀\nLine 2 🌍\nLine 3';
			const result  = linter.detectEmojis(content);

			expect(result).toHaveLength(2);
			expect(result[0].emoji).toBe('😀');
			expect(result[0].line).toBe(1);
			expect(result[1].emoji).toBe('🌍');
			expect(result[1].line).toBe(2);
		});

		it('should respect whitelist', () => {
			const content = 'Hello © world 😀!';
			const result  = linter.detectEmojis(content);

			expect(result).toHaveLength(1);
			expect(result[0].emoji).toBe('😀');
		});
	});

	describe('fraktoEmojiLinter.removeEmojis', () => {
		it('should remove emojis from string', () => {
			const content = 'Hello 😀 world 🌍!';
			const result  = linter.removeEmojis(content);

			expect(result).toBe('Hello  world !');
		});

		it('should return unchanged string without emojis', () => {
			const content = 'Hello world!';
			const result  = linter.removeEmojis(content);

			expect(result).toBe('Hello world!');
		});

		it('should handle empty string', () => {
			const result = linter.removeEmojis('');
			expect(result).toBe('');
		});

		it('should remove complex emojis', () => {
			const content = 'Family 👨‍👩‍👧‍👦 and flag 🏴‍☠️';
			const result  = linter.removeEmojis(content);

			expect(result).not.toContain('👨');
			expect(result).not.toContain('👩');
			expect(result).not.toContain('👧');
			expect(result).not.toContain('👦');
			expect(result).not.toContain('🏴');
			expect(result).not.toContain('☠️');
		});

		it('should handle multiline strings', () => {
			const content = 'Line 1 😀\nLine 2 🌍\nLine 3';
			const result  = linter.removeEmojis(content);

			expect(result).toBe('Line 1 \nLine 2 \nLine 3');
		});

		it('should preserve whitelisted emojis', () => {
			const content = 'Hello © world 😀!';
			const result  = linter.removeEmojis(content);

			expect(result).toBe('Hello © world !');
		});
	});

	describe('fraktoEmojiLinter configuration', () => {
		it('should use custom message', () => {
			const customLinter = new fraktoEmojiLinter({
				message: 'Custom emoji message'
			});
			const content      = 'Hello 😀';
			const result       = customLinter.detectEmojis(content);

			expect(result).toHaveLength(1);
			expect(result[0].message).toBe('Custom emoji message');
		});

		it('should use custom severity', () => {
			const customLinter = new fraktoEmojiLinter({
				severity: fraktoEmojiLinter.severities.warning
			});
			const content      = 'Hello 😀';
			const result       = customLinter.detectEmojis(content);

			expect(result).toHaveLength(1);
			expect(result[0].severity).toBe('warning');
		});

		it('should default to error severity for invalid values', () => {
			const customLinter = new fraktoEmojiLinter({
				severity: 'invalid'
			});
			const content      = 'Hello 😀';
			const result       = customLinter.detectEmojis(content);

			expect(result).toHaveLength(1);
			expect(result[0].severity).toBe('error');
		});

		it('should use custom whitelist', () => {
			const customLinter = new fraktoEmojiLinter({
				whitelist: ['😀', '©']
			});
			const content      = 'Hello 😀 world 🌍 copyright ©';
			const result       = customLinter.detectEmojis(content);

			expect(result).toHaveLength(1);
			expect(result[0].emoji).toBe('🌍');
		});
	});

	describe('linter.lintFile', () => {
		const testFilePath = path.join(dirName, 'temp-test-file.txt');

		afterEach(() => {
			if (fs.existsSync(testFilePath)) {
				fs.unlinkSync(testFilePath);
			}
		});

		it('should lint a file with emojis', () => {
			const content = 'File content with emoji 😀';
			fs.writeFileSync(testFilePath, content, 'utf8');

			const result = linter.lintFile(testFilePath);

			expect(result).toHaveLength(1);
			expect(result[0].emoji).toBe('😀');
			expect(result[0].line).toBe(1);
		});

		it('should lint a file without emojis', () => {
			const content = 'File content without emojis';
			fs.writeFileSync(testFilePath, content, 'utf8');

			const result = linter.lintFile(testFilePath);

			expect(result).toHaveLength(0);
		});

		it('should handle empty file', () => {
			fs.writeFileSync(testFilePath, '', 'utf8');

			const result = linter.lintFile(testFilePath);

			expect(result).toHaveLength(0);
		});
	});

	describe('linter.fixFile', () => {
		const testFilePath = path.join(dirName, 'temp-test-file.txt');

		beforeEach(() => {
			if (fs.existsSync(testFilePath)) {
				fs.unlinkSync(testFilePath);
			}
		});

		afterEach(() => {
			if (fs.existsSync(testFilePath)) {
				fs.unlinkSync(testFilePath);
			}
		});

		it('should fix a file by removing emojis', () => {
			const originalContent = 'File content with emoji 😀 and another 🌍';
			const expectedContent = 'File content with emoji  and another ';
			fs.writeFileSync(testFilePath, originalContent, 'utf8');

			linter.fixFile(testFilePath);

			const resultContent = fs.readFileSync(testFilePath, 'utf8');
			expect(resultContent).toBe(expectedContent);
		});

		it('should handle file without emojis', () => {
			const content = 'File content without emojis';
			fs.writeFileSync(testFilePath, content, 'utf8');

			linter.fixFile(testFilePath);

			const resultContent = fs.readFileSync(testFilePath, 'utf8');
			expect(resultContent).toBe(content);
		});

		it('should handle empty file', () => {
			fs.writeFileSync(testFilePath, '', 'utf8');

			linter.fixFile(testFilePath);

			const resultContent = fs.readFileSync(testFilePath, 'utf8');
			expect(resultContent).toBe('');
		});

		it('should preserve file structure with multiline content', () => {
			const originalContent = 'Line 1 😀\nLine 2 🌍\nLine 3 without emoji';
			const expectedContent = 'Line 1 \nLine 2 \nLine 3 without emoji';
			fs.writeFileSync(testFilePath, originalContent, 'utf8');

			linter.fixFile(testFilePath);

			const resultContent = fs.readFileSync(testFilePath, 'utf8');
			expect(resultContent).toBe(expectedContent);
		});
	});
});
