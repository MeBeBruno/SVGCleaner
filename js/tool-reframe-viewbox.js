import { ExactRational } from './exact-mathematics.js';
import { PathGeometryEngine } from './path-geometry.js';

export const reframeViewBoxToolDefinition = {
	identifier: 'reframe',
	label: 'Reframe',
	iconName: 'crop',
	tooltip: 'Fit viewBox tightly to the exact analytical geometry bounding box without altering coordinates',
	defaultOptions: {
		padding: '0',
		removeDimensions: true
	},
	executeOnDom(svgRootElement, parsedDocument, options) {
		const analyticalBounds = PathGeometryEngine.calculateExactAnalyticalBoundingBox(svgRootElement, false);
		if (!analyticalBounds) {
			throw new Error('SVG contains no measurable visible geometry.');
		}
		const paddingRational = new ExactRational(options.padding || '0');
		const framedX = analyticalBounds.x.subtract(paddingRational);
		const framedY = analyticalBounds.y.subtract(paddingRational);
		const framedWidth = analyticalBounds.width.add(paddingRational.multiply(ExactRational.TWO));
		const framedHeight = analyticalBounds.height.add(paddingRational.multiply(ExactRational.TWO));

		svgRootElement.setAttribute(
			'viewBox',
			`${framedX.toString()} ${framedY.toString()} ${framedWidth.toString()} ${framedHeight.toString()}`
		);
		if (options.removeDimensions) {
			svgRootElement.removeAttribute('width');
			svgRootElement.removeAttribute('height');
		}
	}
};