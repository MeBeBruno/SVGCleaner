const HISTORY_STORAGE_KEY = 'svgPrecisionSuiteHistory_v3';
const MAXIMUM_HISTORY_ENTRIES = 30;

export class FormatAndDiffEngine {
	static detectIndentationString(svgString) {
		const indentationMatch = svgString.match(/\n([ \t]+)</);
		return indentationMatch ? indentationMatch[1] : '\t';
	}

	static serializeDomPreservingIndentation(originalSvgString, mutatedSvgRootElement) {
		const xmlSerializer = new XMLSerializer();
		const serializedString = xmlSerializer.serializeToString(mutatedSvgRootElement);
		const xmlDeclarationMatch = originalSvgString.match(/^<\?xml[^>]*\?>\s*/i);
		const declarationPrefix = xmlDeclarationMatch ? xmlDeclarationMatch[0] : '';

		const originalIsMultiline = originalSvgString.trim().includes('\n');
		if (originalIsMultiline && !serializedString.includes('\n')) {
			return declarationPrefix + this.formatXmlStructure(serializedString, this.detectIndentationString(originalSvgString));
		}
		return declarationPrefix + serializedString;
	}

	static formatXmlStructure(rawXmlString, indentationUnit = '\t') {
		const splitTagsString = rawXmlString.replace(/>(\s*)</g, '>\n<').trim();
		const rawLines = splitTagsString.split('\n');
		let currentIndentDepth = 0;

		return rawLines
			.map((rawLine) => {
				const trimmedLine = rawLine.trim();
				if (trimmedLine.startsWith('</')) {
					currentIndentDepth = Math.max(0, currentIndentDepth - 1);
				}
				const formattedLine = indentationUnit.repeat(currentIndentDepth) + trimmedLine;
				const isOpeningTag =
					trimmedLine.startsWith('<') &&
					!trimmedLine.startsWith('</') &&
					!trimmedLine.endsWith('/>') &&
					!trimmedLine.startsWith('<?') &&
					!trimmedLine.startsWith('<!') &&
					!/<\/[^>]+>$/.test(trimmedLine);
				if (isOpeningTag) {
					currentIndentDepth++;
				}
				return formattedLine;
			})
			.join('\n');
	}

	static escapeHtmlEntities(rawText) {
		return String(rawText)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	static computeInlineTokenHighlight(removedLine, addedLine) {
		const splitTokens = (lineText) => lineText.match(/(\s+|[<>=/"']+|[^<>=/"'\s]+)/g) || [];
		const tokensOld = splitTokens(removedLine);
		const tokensNew = splitTokens(addedLine);

		let commonPrefixLength = 0;
		while (
			commonPrefixLength < tokensOld.length &&
			commonPrefixLength < tokensNew.length &&
			tokensOld[commonPrefixLength] === tokensNew[commonPrefixLength]
		) {
			commonPrefixLength++;
		}

		let endOldIndex = tokensOld.length - 1;
		let endNewIndex = tokensNew.length - 1;
		while (
			endOldIndex >= commonPrefixLength &&
			endNewIndex >= commonPrefixLength &&
			tokensOld[endOldIndex] === tokensNew[endNewIndex]
		) {
			endOldIndex--;
			endNewIndex--;
		}

		const sharedPrefixHtml = this.escapeHtmlEntities(tokensOld.slice(0, commonPrefixLength).join(''));
		const sharedSuffixHtml = this.escapeHtmlEntities(tokensOld.slice(endOldIndex + 1).join(''));
		const middleOldTokens = tokensOld.slice(commonPrefixLength, endOldIndex + 1);
		const middleNewTokens = tokensNew.slice(commonPrefixLength, endNewIndex + 1);

		if (middleOldTokens.length * middleNewTokens.length <= 3000) {
			const matrix = Array.from({ length: middleOldTokens.length + 1 }, () => new Int16Array(middleNewTokens.length + 1));
			for (let row = middleOldTokens.length - 1; row >= 0; row--) {
				for (let column = middleNewTokens.length - 1; column >= 0; column--) {
					matrix[row][column] =
						middleOldTokens[row] === middleNewTokens[column]
							? 1 + matrix[row + 1][column + 1]
							: Math.max(matrix[row + 1][column], matrix[row][column + 1]);
				}
			}
			let row = 0;
			let column = 0;
			let deletedMiddleHtml = '';
			let insertedMiddleHtml = '';
			while (row < middleOldTokens.length || column < middleNewTokens.length) {
				if (row < middleOldTokens.length && column < middleNewTokens.length && middleOldTokens[row] === middleNewTokens[column]) {
					const escapedToken = this.escapeHtmlEntities(middleOldTokens[row]);
					deletedMiddleHtml += escapedToken;
					insertedMiddleHtml += escapedToken;
					row++;
					column++;
				} else if (column < middleNewTokens.length && (row === middleOldTokens.length || matrix[row][column + 1] >= matrix[row + 1][column])) {
					insertedMiddleHtml += `<ins class='token-inserted'>${this.escapeHtmlEntities(middleNewTokens[column])}</ins>`;
					column++;
				} else {
					deletedMiddleHtml += `<del class='token-deleted'>${this.escapeHtmlEntities(middleOldTokens[row])}</del>`;
					row++;
				}
			}
			return {
				removedHtml: sharedPrefixHtml + deletedMiddleHtml + sharedSuffixHtml,
				addedHtml: sharedPrefixHtml + insertedMiddleHtml + sharedSuffixHtml
			};
		}

		return {
			removedHtml: `${sharedPrefixHtml}<del class='token-deleted'>${this.escapeHtmlEntities(middleOldTokens.join(''))}</del>${sharedSuffixHtml}`,
			addedHtml: `${sharedPrefixHtml}<ins class='token-inserted'>${this.escapeHtmlEntities(middleNewTokens.join(''))}</ins>${sharedSuffixHtml}`
		};
	}

	static generateDiffMarkup(originalSvgText, processedSvgText) {
		const originalLines = originalSvgText.replace(/\r\n/g, '\n').split('\n');
		const processedLines = processedSvgText.replace(/\r\n/g, '\n').split('\n');
		const htmlRows = [];
		let oldIndex = 0;
		let newIndex = 0;
		let oldLineNumber = 1;
		let newLineNumber = 1;

		while (oldIndex < originalLines.length || newIndex < processedLines.length) {
			if (oldIndex < originalLines.length && newIndex < processedLines.length && originalLines[oldIndex] === processedLines[newIndex]) {
				htmlRows.push(
					`<div class='diff-line'><span class='diff-number'>${newLineNumber}</span><span class='diff-marker'> </span><span class='diff-text'>${this.escapeHtmlEntities(processedLines[newIndex])}</span></div>`
				);
				oldIndex++;
				newIndex++;
				oldLineNumber++;
				newLineNumber++;
			} else {
				let lookaheadMatchOld = -1;
				let lookaheadMatchNew = -1;
				for (let offset = 1; offset <= 8; offset++) {
					if (oldIndex + offset < originalLines.length && newIndex < processedLines.length && originalLines[oldIndex + offset] === processedLines[newIndex]) {
						lookaheadMatchOld = oldIndex + offset;
						break;
					}
					if (newIndex + offset < processedLines.length && oldIndex < originalLines.length && originalLines[oldIndex] === processedLines[newIndex + offset]) {
						lookaheadMatchNew = newIndex + offset;
						break;
					}
				}

				if (lookaheadMatchOld !== -1) {
					while (oldIndex < lookaheadMatchOld) {
						htmlRows.push(
							`<div class='diff-line removed'><span class='diff-number'>${oldLineNumber++}</span><span class='diff-marker'>−</span><span class='diff-text'><del class='token-deleted'>${this.escapeHtmlEntities(originalLines[oldIndex++])}</del></span></div>`
						);
					}
				} else if (lookaheadMatchNew !== -1) {
					while (newIndex < lookaheadMatchNew) {
						htmlRows.push(
							`<div class='diff-line added'><span class='diff-number'>${newLineNumber++}</span><span class='diff-marker'>+</span><span class='diff-text'><ins class='token-inserted'>${this.escapeHtmlEntities(processedLines[newIndex++])}</ins></span></div>`
						);
					}
				} else if (oldIndex < originalLines.length && newIndex < processedLines.length) {
					const inlineComparison = this.computeInlineTokenHighlight(originalLines[oldIndex], processedLines[newIndex]);
					htmlRows.push(
						`<div class='diff-line removed'><span class='diff-number'>${oldLineNumber++}</span><span class='diff-marker'>−</span><span class='diff-text'>${inlineComparison.removedHtml}</span></div>`,
						`<div class='diff-line added'><span class='diff-number'>${newLineNumber++}</span><span class='diff-marker'>+</span><span class='diff-text'>${inlineComparison.addedHtml}</span></div>`
					);
					oldIndex++;
					newIndex++;
				} else if (oldIndex < originalLines.length) {
					htmlRows.push(
						`<div class='diff-line removed'><span class='diff-number'>${oldLineNumber++}</span><span class='diff-marker'>−</span><span class='diff-text'><del class='token-deleted'>${this.escapeHtmlEntities(originalLines[oldIndex++])}</del></span></div>`
					);
				} else if (newIndex < processedLines.length) {
					htmlRows.push(
						`<div class='diff-line added'><span class='diff-number'>${newLineNumber++}</span><span class='diff-marker'>+</span><span class='diff-text'><ins class='token-inserted'>${this.escapeHtmlEntities(processedLines[newIndex++])}</ins></span></div>`
					);
				}
			}
		}
		return htmlRows.join('');
	}

	static generatePlainCodeMarkup(svgText) {
		return svgText
			.replace(/\r\n/g, '\n')
			.split('\n')
			.map((lineText, index) => `<div class='diff-line'><span class='diff-number'>${index + 1}</span><span class='diff-marker'> </span><span class='diff-text'>${this.escapeHtmlEntities(lineText)}</span></div>`)
			.join('');
	}
}

export class LocalHistoryStorage {
	static retrieveEntries() {
		try {
			return JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
		} catch {
			return [];
		}
	}

	static recordEntry({ toolIdentifier, fileName, inputSvg, outputSvg }) {
		if (!inputSvg || !outputSvg) return;
		const existingEntries = this.retrieveEntries();
		if (
			existingEntries.length > 0 &&
			existingEntries[0].inputSvg === inputSvg &&
			existingEntries[0].outputSvg === outputSvg &&
			existingEntries[0].toolIdentifier === toolIdentifier
		) {
			return;
		}
		const newEntry = {
			identifier: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
			timestamp: new Date().toISOString().slice(11, 19),
			toolIdentifier,
			fileName: fileName || 'vector.svg',
			inputSvg,
			outputSvg
		};
		existingEntries.unshift(newEntry);
		if (existingEntries.length > MAXIMUM_HISTORY_ENTRIES) {
			existingEntries.length = MAXIMUM_HISTORY_ENTRIES;
		}
		try {
			localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(existingEntries));
		} catch {
			existingEntries.length = 8;
			localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(existingEntries));
		}
	}

	static removeEntry(entryIdentifier) {
		const filteredEntries = this.retrieveEntries().filter((entry) => entry.identifier !== entryIdentifier);
		localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filteredEntries));
	}

	static clearAllEntries() {
		localStorage.removeItem(HISTORY_STORAGE_KEY);
	}
}