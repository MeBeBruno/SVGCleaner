import { PathGeometryEngine } from './path-geometry.js';

export const cleanToolDefinition = {
	identifier: 'clean',
	label: 'Clean',
	iconName: 'sparkles',
	tooltip: 'Lossless removal of editor metadata, comments, redundant attributes and empty groups',
	defaultOptions: {
		removeComments: true,
		removeMetadata: true,
		removeEmptyElements: true,
		cleanAttributes: true,
		removeDimensions: true,
		cleanNamespaces: true,
		normalizeIds: true,
		flattenEmptyGroups: true,
		normalizePathWhitespace: false
	},
	executeOnDom(svgRootElement, parsedDocument, options) {
		if (options.removeComments) {
			const commentIterator = parsedDocument.createNodeIterator(
				svgRootElement,
				NodeFilter.SHOW_COMMENT,
				null,
				false
			);
			const commentsToRemove = [];
			let currentCommentNode;
			while ((currentCommentNode = commentIterator.nextNode())) {
				commentsToRemove.push(currentCommentNode);
			}
			for (const commentNode of commentsToRemove) {
				if (commentNode.parentNode) {
					commentNode.parentNode.removeChild(commentNode);
				}
			}
		}

		if (options.removeMetadata) {
			for (const metadataElement of Array.from(svgRootElement.querySelectorAll('metadata, title, desc'))) {
				if (metadataElement.parentNode) {
					metadataElement.parentNode.removeChild(metadataElement);
				}
			}
		}

		if (options.cleanNamespaces) {
			const redundantNamespaces = [
				'xmlns:dc', 'xmlns:cc', 'xmlns:rdf', 'xmlns:svg', 'xmlns:sodipodi', 'xmlns:inkscape', 'version', 'xml:space'
			];
			for (const namespaceAttribute of redundantNamespaces) {
				svgRootElement.removeAttribute(namespaceAttribute);
			}
		}

		if (options.removeDimensions) {
			if (!svgRootElement.hasAttribute('viewBox') && svgRootElement.hasAttribute('width') && svgRootElement.hasAttribute('height')) {
				const rawWidth = svgRootElement.getAttribute('width').replace(/[a-z%]+/gi, '').trim();
				const rawHeight = svgRootElement.getAttribute('height').replace(/[a-z%]+/gi, '').trim();
				if (rawWidth && rawHeight && !Number.isNaN(Number(rawWidth)) && !Number.isNaN(Number(rawHeight))) {
					svgRootElement.setAttribute('viewBox', `0 0 ${rawWidth} ${rawHeight}`);
				}
			}
			svgRootElement.removeAttribute('width');
			svgRootElement.removeAttribute('height');
		}

		if (options.cleanAttributes) {
			const defaultAttributeMap = {
				'stroke-miterlimit': '4',
				'stroke-opacity': '1',
				'fill-opacity': '1',
				'opacity': '1',
				'stroke-linecap': 'butt',
				'stroke-linejoin': 'miter',
				'visibility': 'visible',
				'display': 'inline'
			};
			for (const element of Array.from(svgRootElement.querySelectorAll('*'))) {
				for (const attribute of Array.from(element.attributes)) {
					const isDefaultValue = defaultAttributeMap[attribute.name] === attribute.value;
					const isEditorNamespace = attribute.name.startsWith('sodipodi:') || attribute.name.startsWith('inkscape:') || attribute.name.startsWith('sketch:');
					const isEmptyValue = attribute.value.trim() === '' && attribute.name !== 'id' && attribute.name !== 'class';
					if (isDefaultValue || isEditorNamespace || isEmptyValue) {
						element.removeAttribute(attribute.name);
					}
				}
			}
		}

		if (options.flattenEmptyGroups) {
			for (const element of Array.from(svgRootElement.querySelectorAll('*'))) {
				if (element.getAttribute('display') === 'none' || element.getAttribute('visibility') === 'hidden' || element.getAttribute('opacity') === '0') {
					if (element.parentNode) {
						element.parentNode.removeChild(element);
					}
				}
			}
			for (const groupElement of Array.from(svgRootElement.querySelectorAll('g'))) {
				if (!groupElement.hasAttributes() && groupElement.parentNode) {
					while (groupElement.firstChild) {
						groupElement.parentNode.insertBefore(groupElement.firstChild, groupElement);
					}
					groupElement.parentNode.removeChild(groupElement);
				}
			}
		}

		if (options.removeEmptyElements) {
			for (const containerElement of Array.from(svgRootElement.querySelectorAll('g, defs'))) {
				if (containerElement.children.length === 0 && !containerElement.textContent.trim() && !containerElement.hasAttributes()) {
					if (containerElement.parentNode) {
						containerElement.parentNode.removeChild(containerElement);
					}
				}
			}
		}

		if (options.normalizeIds) {
			const nonAsciiPattern = /[^\x00-\x7F]/;
			let identifierSequence = 1;
			const replacementMap = new Map();
			for (const elementWithId of Array.from(svgRootElement.querySelectorAll('[id]'))) {
				const originalIdentifier = elementWithId.getAttribute('id');
				if (nonAsciiPattern.test(originalIdentifier)) {
					const newIdentifier = `${elementWithId.tagName.toLowerCase()}-${identifierSequence++}`;
					replacementMap.set(originalIdentifier, newIdentifier);
					elementWithId.setAttribute('id', newIdentifier);
				}
			}
			replacementMap.forEach((newIdentifier, oldIdentifier) => {
				for (const element of Array.from(svgRootElement.querySelectorAll('*'))) {
					for (const attribute of Array.from(element.attributes)) {
						if (attribute.value === `#${oldIdentifier}`) {
							element.setAttribute(attribute.name, `#${newIdentifier}`);
						} else if (attribute.value.includes(`url(#${oldIdentifier})`)) {
							element.setAttribute(attribute.name, attribute.value.replace(`url(#${oldIdentifier})`, `url(#${newIdentifier})`));
						}
					}
				}
			});
		}

		if (options.normalizePathWhitespace) {
			for (const pathElement of Array.from(svgRootElement.querySelectorAll('path[d]'))) {
				const parsedSegments = PathGeometryEngine.parsePathSegments(pathElement.getAttribute('d'));
				pathElement.setAttribute('d', PathGeometryEngine.serializeSegments(parsedSegments));
			}
		}
	}
};