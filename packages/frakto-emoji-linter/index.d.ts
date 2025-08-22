interface EmojiMatch {
	index: number;
	emoji: string;
	line: number;
	column: number;
	endLine: number;
	endColumn: number;
}

interface FraktoEmojiLinter {
	(content: string): EmojiMatch[];
	lintString(content: string): EmojiMatch[];
	lintFile(filePath: string): EmojiMatch[];
	fixString(content: string): string;
	fixFile(filePath: string): void;
}

declare const fraktoEmojiLinter: FraktoEmojiLinter;
export default fraktoEmojiLinter;
