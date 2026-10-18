import { AffineTransformationMatrix } from './exact-mathematics.js';
import { PathGeometryEngine } from './path-geometry.js';

const BASIC_SHAPE_TAG_NAMES = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);

function unwrapEmptyGroupElement(groupElement) {
	if (groupElement.tagName.toLowerCase() !== 'g' || groupElement.hasAttributes() || !groupElement.parentNode) {
		return;
	}
	while (groupElement.firstChild) {
		groupElement.parentNode.insertBefore(groupElement.firstChild, groupElement);
	}
	groupElement.parentNode.removeChild(groupElement);
}

function normalizeElementNodeRecursively(currentNode, accumulatedMatrix, parsedDocument, options) {
	if (currentNode.nodeType !== Node.ELEMENT_NODE) {
		return;
	}
	let localMatrix = accumulatedMatrix;
	const transformAttribute = currentNode.getAttribute('transform');
	if (transformAttribute) {
		const nodeMatrix = AffineTransformationMatrix.parseTransformAttributeString(transformAttribute);
		localMatrix = accumulatedMatrix.multiplyWithMatrix(nodeMatrix);
		currentNode.removeAttribute('transform');
	}

	let targetElement = currentNode;
	const initialTagName = currentNode.tagName.toLowerCase();

	if (BASIC_SHAPE_TAG_NAMES.has(initialTagName)) {
		if (options.convertShapes) {
			targetElement = PathGeometryEngine.replaceBasicShapeWithPath(currentNode, parsedDocument);
		} else {
			targetElement = PathGeometryEngine.transformNativeShapeElementDirectly(currentNode, localMatrix, parsedDocument);
		}
	}

	if (targetElement.tagName.toLowerCase() === 'path' && targetElement.hasAttribute('d')) {
		const transformedPathString = PathGeometryEngine.transformPathByMatrix(targetElement.getAttribute('d'), localMatrix, false);
		if (options.outputRelative) {
			const parsedSegments = PathGeometryEngine.parsePathSegments(transformedPathString);
			const relativeSegments = PathGeometryEngine.convertSegmentsToRelative(parsedSegments);
			targetElement.setAttribute('d', PathGeometryEngine.serializeSegments(relativeSegments));
		} else {
			targetElement.setAttribute('d', transformedPathString);
		}
	}

	for (const childNode of Array.from(targetElement.childNodes)) {
		normalizeElementNodeRecursively(childNode, localMatrix, parsedDocument, options);
	}

	if (options.unwrapTransformedGroups) {
		unwrapEmptyGroupElement(targetElement);
	}
}

export const flattenTransformsToolDefinition = {
	identifier: 'flatten',
	label: 'Flatten',
	iconName: 'layers',
	tooltip: 'Bake nested transform attributes directly into native shape attributes or path coordinates',
	defaultOptions: {
		convertShapes: false,
		outputRelative: false,
		unwrapTransformedGroups: false
	},
	executeOnDom(svgRootElement, parsedDocument, options) {
		normalizeElementNodeRecursively(
			svgRootElement,
			AffineTransformationMatrix.createIdentityMatrix(),
			parsedDocument,
			options
		);
	}
};