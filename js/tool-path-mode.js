import { PathGeometryEngine } from './path-geometry.js';

export const pathModeToolDefinition = {
	identifier: 'path',
	label: 'Path',
	iconName: 'route',
	tooltip: 'Convert path commands between Relative (m, l, c, z) and Absolute (M, L, C, Z) with exact rational subtraction',
	defaultOptions: {
		direction: 'toRelative',
		convertShapes: false
	},
	executeOnDom(svgRootElement, parsedDocument, options) {
		if (options.convertShapes) {
			for (const shapeElement of Array.from(svgRootElement.querySelectorAll('rect, circle, ellipse, line, polyline, polygon'))) {
				PathGeometryEngine.replaceBasicShapeWithPath(shapeElement, parsedDocument);
			}
		}
		for (const pathElement of Array.from(svgRootElement.querySelectorAll('path[d]'))) {
			const parsedSegments = PathGeometryEngine.parsePathSegments(pathElement.getAttribute('d'));
			if (parsedSegments.length === 0) continue;
			const convertedSegments = options.direction === 'toAbsolute'
				? PathGeometryEngine.convertSegmentsToAbsolute(parsedSegments)
				: PathGeometryEngine.convertSegmentsToRelative(parsedSegments);
			pathElement.setAttribute('d', PathGeometryEngine.serializeSegments(convertedSegments));
		}
	},
	executeDirectStringPatch(rawSvgString, options) {
		if (options.convertShapes || !rawSvgString.includes('<svg')) {
			return null;
		}
		return rawSvgString.replace(/(\bd\s*=\s*(['"]))([\s\S]*?)(\2)/g, (fullMatch, attributePrefix, quoteCharacter, pathDataContent, closingQuote) => {
			const parsedSegments = PathGeometryEngine.parsePathSegments(pathDataContent);
			if (parsedSegments.length === 0) return fullMatch;
			const convertedSegments = options.direction === 'toAbsolute'
				? PathGeometryEngine.convertSegmentsToAbsolute(parsedSegments)
				: PathGeometryEngine.convertSegmentsToRelative(parsedSegments);
			return `${attributePrefix}${PathGeometryEngine.serializeSegments(convertedSegments)}${closingQuote}`;
		});
	}
};