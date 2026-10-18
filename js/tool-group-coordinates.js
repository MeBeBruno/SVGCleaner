import { ExactRational, AffineTransformationMatrix } from './exact-mathematics.js';
import { PathGeometryEngine } from './path-geometry.js';

const NATIVE_TRANSLATABLE_TAGS = new Set([
	'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'image', 'use'
]);

function calculateDomElementDepth(element, rootElement) {
	let depthCount = 0;
	let currentCursor = element;
	while (currentCursor && currentCursor !== rootElement) {
		depthCount++;
		currentCursor = currentCursor.parentNode;
	}
	return depthCount;
}

function normalizeSingleGroupElement(groupElement) {
	const analyticalBounds = PathGeometryEngine.calculateExactAnalyticalBoundingBox(groupElement, true);
	if (!analyticalBounds) {
		return;
	}
	const shiftX = analyticalBounds.x;
	const shiftY = analyticalBounds.y;
	if (shiftX.isZero() && shiftY.isZero()) {
		return;
	}

	const negativeShiftX = shiftX.negate();
	const negativeShiftY = shiftY.negate();
	const childTranslationMatrix = new AffineTransformationMatrix(
		ExactRational.ONE, ExactRational.ZERO,
		ExactRational.ZERO, ExactRational.ONE,
		negativeShiftX, negativeShiftY
	);

	for (const childElement of Array.from(groupElement.children)) {
		const tagName = childElement.tagName.toLowerCase();
		const hasExistingTransform = childElement.hasAttribute('transform');

		if (tagName === 'path' && !hasExistingTransform) {
			const pathData = childElement.getAttribute('d');
			if (pathData) {
				childElement.setAttribute(
					'd',
					PathGeometryEngine.translatePathPreservingCommandMode(pathData, negativeShiftX, negativeShiftY)
				);
			}
		} else if (NATIVE_TRANSLATABLE_TAGS.has(tagName) && !hasExistingTransform) {
			PathGeometryEngine.translateNativeShapeElementAttributes(childElement, negativeShiftX, negativeShiftY);
		} else {
			const existingChildMatrix = AffineTransformationMatrix.parseTransformAttributeString(
				childElement.getAttribute('transform')
			);
			const updatedChildMatrix = childTranslationMatrix.multiplyWithMatrix(existingChildMatrix);
			const transformString = updatedChildMatrix.toTransformAttributeString();
			if (transformString) {
				childElement.setAttribute('transform', transformString);
			} else {
				childElement.removeAttribute('transform');
			}
		}
	}

	const groupCompensationMatrix = new AffineTransformationMatrix(
		ExactRational.ONE, ExactRational.ZERO,
		ExactRational.ZERO, ExactRational.ONE,
		shiftX, shiftY
	);
	const existingGroupMatrix = AffineTransformationMatrix.parseTransformAttributeString(
		groupElement.getAttribute('transform')
	);
	const updatedGroupMatrix = existingGroupMatrix.multiplyWithMatrix(groupCompensationMatrix);
	const updatedGroupTransformString = updatedGroupMatrix.toTransformAttributeString();
	if (updatedGroupTransformString) {
		groupElement.setAttribute('transform', updatedGroupTransformString);
	} else {
		groupElement.removeAttribute('transform');
	}
}

export const groupCoordinatesToolDefinition = {
	identifier: 'groups',
	label: 'Groups',
	iconName: 'boxes',
	tooltip: 'Shift child coordinates of every <g> group to its analytical (0|0) bounding box origin and compensate via group translate()',
	defaultOptions: {
		convertShapes: false
	},
	executeOnDom(svgRootElement, parsedDocument, options) {
		if (options.convertShapes) {
			for (const shapeElement of Array.from(svgRootElement.querySelectorAll('rect, circle, ellipse, line, polyline, polygon'))) {
				PathGeometryEngine.replaceBasicShapeWithPath(shapeElement, parsedDocument);
			}
		}

		const sortedGroupElements = Array.from(svgRootElement.querySelectorAll('g')).sort(
			(firstGroup, secondGroup) =>
				calculateDomElementDepth(secondGroup, svgRootElement) - calculateDomElementDepth(firstGroup, svgRootElement)
		);

		for (const groupElement of sortedGroupElements) {
			normalizeSingleGroupElement(groupElement);
		}
	}
};