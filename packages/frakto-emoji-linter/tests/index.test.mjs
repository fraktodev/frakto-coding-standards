// Dependencies
import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'url';
import fraktoEmojiLinter from '../index.mjs';

// Declarations
const fileName = fileURLToPath(import.meta.url);
const dirName  = path.dirname(fileName);

// Tests
describe('frakto-emoji-linter', () => {
	describe('fraktoEmojiLinter.lintString', () => {
		it('should detect emojis in a string', () => {
			const content = 'Hello 😀 world 🌍!';
			const result  = fraktoEmojiLinter.lintString(content);

			expect(result).toHaveLength(2);
			expect(result[0]).toEqual({ index: 6, emoji: '😀' });
			expect(result[1]).toEqual({ index: 15, emoji: '🌍' });
		});

		it('should return empty array for string without emojis', () => {
			const content = 'Hello world!';
			const result  = fraktoEmojiLinter.lintString(content);

			expect(result).toHaveLength(0);
		});

		it('should detect complex emojis', () => {
			const content = 'Family 👨‍👩‍👧‍👦 and flag 🏴‍☠️';
			const result  = fraktoEmojiLinter.lintString(content);

			expect(result.length).toBeGreaterThan(0);
			expect(result.some((match) => match.emoji.includes('👨'))).toBe(true);
		});

		it('should handle empty string', () => {
			const result = fraktoEmojiLinter.lintString('');
			expect(result).toHaveLength(0);
		});

		it('should handle multiline strings', () => {
			const content = 'Line 1 😀\nLine 2 🌍\nLine 3';
			const result  = fraktoEmojiLinter.lintString(content);

			expect(result).toHaveLength(2);
			expect(result[0].emoji).toBe('😀');
			expect(result[1].emoji).toBe('🌍');
		});
	});

	describe('fraktoEmojiLinter.fixString', () => {
		it('should remove emojis from string', () => {
			const content = 'Hello 😀 world 🌍!';
			const result  = fraktoEmojiLinter.fixString(content);

			expect(result).toBe('Hello  world !');
		});

		it('should return unchanged string without emojis', () => {
			const content = 'Hello world!';
			const result  = fraktoEmojiLinter.fixString(content);

			expect(result).toBe('Hello world!');
		});

		it('should handle empty string', () => {
			const result = fraktoEmojiLinter.fixString('');
			expect(result).toBe('');
		});

		it('should remove complex emojis', () => {
			const content = 'Family 👨‍👩‍👧‍👦 and flag 🏴‍☠️';
			const result  = fraktoEmojiLinter.fixString(content);

			expect(result).not.toContain('👨');
			expect(result).not.toContain('👩');
			expect(result).not.toContain('👧');
			expect(result).not.toContain('👦');
			expect(result).not.toContain('🏴');
			expect(result).not.toContain('☠️');
		});

		it('should handle multiline strings', () => {
			const content = 'Line 1 😀\nLine 2 🌍\nLine 3';
			const result  = fraktoEmojiLinter.fixString(content);

			expect(result).toBe('Line 1 \nLine 2 \nLine 3');
		});
	});

	describe('fraktoEmojiLinter.lintFile', () => {
		const testFilePath = path.join(dirName, 'temp-test-file.txt');

		afterEach(() => {
			if (fs.existsSync(testFilePath)) {
				fs.unlinkSync(testFilePath);
			}
		});

		it('should lint a file with emojis', () => {
			const content = 'File content with emoji 😀';
			fs.writeFileSync(testFilePath, content, 'utf8');

			const result = fraktoEmojiLinter.lintFile(testFilePath);

			expect(result).toHaveLength(1);
			expect(result[0]).toEqual({ index: 24, emoji: '😀' });
		});

		it('should lint a file without emojis', () => {
			const content = 'File content without emojis';
			fs.writeFileSync(testFilePath, content, 'utf8');

			const result = fraktoEmojiLinter.lintFile(testFilePath);

			expect(result).toHaveLength(0);
		});

		it('should handle empty file', () => {
			fs.writeFileSync(testFilePath, '', 'utf8');

			const result = fraktoEmojiLinter.lintFile(testFilePath);

			expect(result).toHaveLength(0);
		});
	});

	describe('fraktoEmojiLinter.fixFile', () => {
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

			fraktoEmojiLinter.fixFile(testFilePath);

			const resultContent = fs.readFileSync(testFilePath, 'utf8');
			expect(resultContent).toBe(expectedContent);
		});

		it('should handle file without emojis', () => {
			const content = 'File content without emojis';
			fs.writeFileSync(testFilePath, content, 'utf8');

			fraktoEmojiLinter.fixFile(testFilePath);

			const resultContent = fs.readFileSync(testFilePath, 'utf8');
			expect(resultContent).toBe(content);
		});

		it('should handle empty file', () => {
			fs.writeFileSync(testFilePath, '', 'utf8');

			fraktoEmojiLinter.fixFile(testFilePath);

			const resultContent = fs.readFileSync(testFilePath, 'utf8');
			expect(resultContent).toBe('');
		});

		it('should preserve file structure with multiline content', () => {
			const originalContent = 'Line 1 😀\nLine 2 🌍\nLine 3 without emoji';
			const expectedContent = 'Line 1 \nLine 2 \nLine 3 without emoji';
			fs.writeFileSync(testFilePath, originalContent, 'utf8');

			fraktoEmojiLinter.fixFile(testFilePath);

			const resultContent = fs.readFileSync(testFilePath, 'utf8');
			expect(resultContent).toBe(expectedContent);
		});
	});
});
