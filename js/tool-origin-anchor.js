import { ExactRational, AffineTransformationMatrix } from './exact-mathematics.js';
import { PathGeometryEngine } from './path-geometry.js';

export function shiftSvgElementCoordinatesLosslessly(svgRootElement, differenceX, differenceY) {
	if (differenceX.isZero() && differenceY.isZero()) {
		return;
	}
	const globalTranslationMatrix = new AffineTransformationMatrix(
		ExactRational.ONE, ExactRational.ZERO,
		ExactRational.ZERO, ExactRational.ONE,
		differenceX, differenceY
	);

	const shiftElementNode = (element) => {
		if (element.nodeType !== Node.ELEMENT_NODE) return;
		const tagName = element.tagName.toLowerCase();
		if (['defs', 'clippath', 'mask', 'lineargradient', 'radialgradient', 'pattern', 'style', 'metadata'].includes(tagName)) {
			return;
		}

		if (element.hasAttribute('transform')) {
			const currentMatrix = AffineTransformationMatrix.parseTransformAttributeString(element.getAttribute('transform'));
			const shiftedMatrix = globalTranslationMatrix.multiplyWithMatrix(currentMatrix);
			const transformString = shiftedMatrix.toTransformAttributeString();
			if (transformString) element.setAttribute('transform', transformString);
			else element.removeAttribute('transform');
			return;
		}

		for (const horizontalAttribute of ['x', 'cx', 'x1', 'x2']) {
			if (element.hasAttribute(horizontalAttribute)) {
				const updatedHorizontal = new ExactRational(element.getAttribute(horizontalAttribute)).add(differenceX);
				element.setAttribute(horizontalAttribute, updatedHorizontal.toString());
			}
		}
		for (const verticalAttribute of ['y', 'cy', 'y1', 'y2']) {
			if (element.hasAttribute(verticalAttribute)) {
				const updatedVertical = new ExactRational(element.getAttribute(verticalAttribute)).add(differenceY);
				element.setAttribute(verticalAttribute, updatedVertical.toString());
			}
		}
		if (element.hasAttribute('d')) {
			element.setAttribute(
				'd',
				PathGeometryEngine.translatePathPreservingCommandMode(element.getAttribute('d'), differenceX, differenceY)
			);
		}
		if (element.hasAttribute('points')) {
			const rawPoints = element.getAttribute('points');
			const numberRegularExpression = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
			const coordinateTokens = [];
			let match;
			while ((match = numberRegularExpression.exec(rawPoints)) !== null) {
				coordinateTokens.push(new ExactRational(match[0]));
			}
			const pointPairs = [];
			for (let index = 0; index + 1 < coordinateTokens.length; index += 2) {
				const shiftedPointX = coordinateTokens[index].add(differenceX).toString();
				const shiftedPointY = coordinateTokens[index + 1].add(differenceY).toString();
				pointPairs.push(`${shiftedPointX},${shiftedPointY}`);
			}
			element.setAttribute('points', pointPairs.join(' '));
		}

		for (const childElement of Array.from(element.children)) {
			shiftElementNode(childElement);
		}
	};

	for (const topLevelChild of Array.from(svgRootElement.children)) {
		shiftElementNode(topLevelChild);
	}
}

export const originAnchorToolDefinition = {
	identifier: 'origin',
	label: 'Origin',
	iconName: 'crosshair',
	tooltip: 'Shift all coordinates and viewBox so the chosen anchor point sits at exact (0|0)',
	defaultOptions: {
		anchor: 'top_left'
	},
	executeOnDom(svgRootElement, parsedDocument, options) {
		const anchorPosition = options.anchor || 'top_left';
		let minimumX = ExactRational.ZERO;
		let minimumY = ExactRational.ZERO;
		let viewWidth = ExactRational.ZERO;
		let viewHeight = ExactRational.ZERO;

		const viewBoxAttribute = svgRootElement.getAttribute('viewBox');
		if (viewBoxAttribute) {
			const viewBoxTokens = viewBoxAttribute.trim().split(/[\s,]+/).filter(Boolean);
			if (viewBoxTokens.length === 4) {
				minimumX = new ExactRational(viewBoxTokens[0]);
				minimumY = new ExactRational(viewBoxTokens[1]);
				viewWidth = new ExactRational(viewBoxTokens[2]);
				viewHeight = new ExactRational(viewBoxTokens[3]);
			}
		} else {
			const analyticalBounds = PathGeometryEngine.calculateExactAnalyticalBoundingBox(svgRootElement, false);
			if (!analyticalBounds) {
				throw new Error('Cannot determine SVG geometry bounds for origin shift.');
			}
			minimumX = analyticalBounds.x;
			minimumY = analyticalBounds.y;
			viewWidth = analyticalBounds.width;
			viewHeight = analyticalBounds.height;
		}

		let targetOriginX = minimumX;
		let targetOriginY = minimumY;
		if (anchorPosition.includes('center_horizontal')) {
			targetOriginX = minimumX.add(viewWidth.divide(ExactRational.TWO));
		} else if (anchorPosition.includes('right')) {
			targetOriginX = minimumX.add(viewWidth);
		}

		if (anchorPosition.includes('center_vertical')) {
			targetOriginY = minimumY.add(viewHeight.divide(ExactRational.TWO));
		} else if (anchorPosition.includes('bottom')) {
			targetOriginY = minimumY.add(viewHeight);
		}

		const differenceX = targetOriginX.negate();
		const differenceY = targetOriginY.negate();

		shiftSvgElementCoordinatesLosslessly(svgRootElement, differenceX, differenceY);

		const updatedMinimumX = minimumX.add(differenceX);
		const updatedMinimumY = minimumY.add(differenceY);
		svgRootElement.setAttribute(
			'viewBox',
			`${updatedMinimumX.toString()} ${updatedMinimumY.toString()} ${viewWidth.toString()} ${viewHeight.toString()}`
		);
	}
};