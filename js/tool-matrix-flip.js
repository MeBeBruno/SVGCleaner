import { ExactRational, AffineTransformationMatrix } from './exact-mathematics.js';
import { PathGeometryEngine } from './path-geometry.js';

function resolveSvgViewportDimensions(svgRootElement) {
	const viewBoxAttribute = svgRootElement.getAttribute('viewBox');
	if (viewBoxAttribute) {
		const viewBoxParts = viewBoxAttribute.trim().split(/[\s,]+/).filter(Boolean);
		if (viewBoxParts.length === 4) {
			return {
				hasExplicitViewBox: true,
				minimumX: new ExactRational(viewBoxParts[0]),
				minimumY: new ExactRational(viewBoxParts[1]),
				viewWidth: new ExactRational(viewBoxParts[2]),
				viewHeight: new ExactRational(viewBoxParts[3])
			};
		}
	}
	const analyticalBounds = PathGeometryEngine.calculateExactAnalyticalBoundingBox(svgRootElement, false);
	if (analyticalBounds) {
		return {
			hasExplicitViewBox: false,
			minimumX: analyticalBounds.x,
			minimumY: analyticalBounds.y,
			viewWidth: analyticalBounds.width,
			viewHeight: analyticalBounds.height
		};
	}
	return {
		hasExplicitViewBox: false,
		minimumX: ExactRational.ZERO,
		minimumY: ExactRational.ZERO,
		viewWidth: ExactRational.ZERO,
		viewHeight: ExactRational.ZERO
	};
}

function buildSelectedTransformationMatrix(options, viewportBounds) {
	switch (options.mode) {
		case 'flipHorizontalCenter': {
			const translationX = viewportBounds.minimumX.multiply(ExactRational.TWO).add(viewportBounds.viewWidth);
			return {
				recalculateViewBox: false,
				transformationMatrix: new AffineTransformationMatrix(
					ExactRational.ONE.negate(), ExactRational.ZERO,
					ExactRational.ZERO, ExactRational.ONE,
					translationX, ExactRational.ZERO
				)
			};
		}
		case 'flipVerticalCenter': {
			const translationY = viewportBounds.minimumY.multiply(ExactRational.TWO).add(viewportBounds.viewHeight);
			return {
				recalculateViewBox: false,
				transformationMatrix: new AffineTransformationMatrix(
					ExactRational.ONE, ExactRational.ZERO,
					ExactRational.ZERO, ExactRational.ONE.negate(),
					ExactRational.ZERO, translationY
				)
			};
		}
		case 'flipHorizontalOrigin': {
			return {
				recalculateViewBox: true,
				transformationMatrix: new AffineTransformationMatrix(
					ExactRational.ONE.negate(), ExactRational.ZERO,
					ExactRational.ZERO, ExactRational.ONE,
					ExactRational.ZERO, ExactRational.ZERO
				)
			};
		}
		case 'flipVerticalOrigin': {
			return {
				recalculateViewBox: true,
				transformationMatrix: new AffineTransformationMatrix(
					ExactRational.ONE, ExactRational.ZERO,
					ExactRational.ZERO, ExactRational.ONE.negate(),
					ExactRational.ZERO, ExactRational.ZERO
				)
			};
		}
		case 'customMatrix': {
			return {
				recalculateViewBox: true,
				transformationMatrix: new AffineTransformationMatrix(
					options.matrixA || '1',
					options.matrixB || '0',
					options.matrixC || '0',
					options.matrixD || '1',
					options.matrixE || '0',
					options.matrixF || '0'
				)
			};
		}
		default:
			return {
				recalculateViewBox: false,
				transformationMatrix: AffineTransformationMatrix.createIdentityMatrix()
			};
	}
}

export const matrixFlipToolDefinition = {
	identifier: 'matrix',
	label: 'Matrix',
	iconName: 'flip-horizontal',
	tooltip: 'Mirror horizontally/vertically or apply an exact 2D affine matrix [a, b, c, d, e, f] to all coordinates',
	defaultOptions: {
		mode: 'flipHorizontalCenter',
		convertShapes: false,
		matrixA: '1',
		matrixB: '0',
		matrixC: '0',
		matrixD: '-1',
		matrixE: '0',
		matrixF: '0'
	},
	executeOnDom(svgRootElement, parsedDocument, options) {
		const viewportBounds = resolveSvgViewportDimensions(svgRootElement);
		const { transformationMatrix, recalculateViewBox } = buildSelectedTransformationMatrix(options, viewportBounds);

		const shapeElementsList = Array.from(
			svgRootElement.querySelectorAll('rect, circle, ellipse, line, polyline, polygon')
		);
		const existingPathElementsList = Array.from(svgRootElement.querySelectorAll('path[d]'));

		for (const shapeElement of shapeElementsList) {
			if (options.convertShapes) {
				const createdPathElement = PathGeometryEngine.replaceBasicShapeWithPath(shapeElement, parsedDocument);
				createdPathElement.setAttribute(
					'd',
					PathGeometryEngine.transformPathByMatrix(createdPathElement.getAttribute('d'), transformationMatrix, true)
				);
			} else {
				PathGeometryEngine.transformNativeShapeElementDirectly(shapeElement, transformationMatrix, parsedDocument);
			}
		}

		for (const pathElement of existingPathElementsList) {
			pathElement.setAttribute(
				'd',
				PathGeometryEngine.transformPathByMatrix(pathElement.getAttribute('d'), transformationMatrix, true)
			);
		}

		if (recalculateViewBox && viewportBounds.hasExplicitViewBox) {
			const cornerOne = transformationMatrix.transformPoint(viewportBounds.minimumX, viewportBounds.minimumY);
			const cornerTwo = transformationMatrix.transformPoint(
				viewportBounds.minimumX.add(viewportBounds.viewWidth),
				viewportBounds.minimumY
			);
			const cornerThree = transformationMatrix.transformPoint(
				viewportBounds.minimumX,
				viewportBounds.minimumY.add(viewportBounds.viewHeight)
			);
			const cornerFour = transformationMatrix.transformPoint(
				viewportBounds.minimumX.add(viewportBounds.viewWidth),
				viewportBounds.minimumY.add(viewportBounds.viewHeight)
			);

			const newMinimumX = ExactRational.minimum(cornerOne.x, cornerTwo.x, cornerThree.x, cornerFour.x);
			const newMinimumY = ExactRational.minimum(cornerOne.y, cornerTwo.y, cornerThree.y, cornerFour.y);
			const newMaximumX = ExactRational.maximum(cornerOne.x, cornerTwo.x, cornerThree.x, cornerFour.x);
			const newMaximumY = ExactRational.maximum(cornerOne.y, cornerTwo.y, cornerThree.y, cornerFour.y);

			svgRootElement.setAttribute(
				'viewBox',
				`${newMinimumX.toString()} ${newMinimumY.toString()} ${newMaximumX.subtract(newMinimumX).toString()} ${newMaximumY.subtract(newMinimumY).toString()}`
			);
		}
	}
};