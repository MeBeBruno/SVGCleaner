import { ExactRational, AffineTransformationMatrix, PrecisionDisclaimerRegistry } from './exact-mathematics.js';

export function parsePathSegments(pathDataString) {
	if (!pathDataString || !pathDataString.trim()) {
		return [];
	}
	const commandRegularExpression = /([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g;
	const numberRegularExpression = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
	const parsedSegments = [];
	let commandMatch;

	while ((commandMatch = commandRegularExpression.exec(pathDataString)) !== null) {
		const commandCharacter = commandMatch[1];
		const uppercaseCommand = commandCharacter.toUpperCase();
		if (uppercaseCommand === 'Z') {
			parsedSegments.push({ command: commandCharacter, parameters: [] });
			continue;
		}
		const numericTokens = [];
		let numberMatch;
		while ((numberMatch = numberRegularExpression.exec(commandMatch[2])) !== null) {
			numericTokens.push(new ExactRational(numberMatch[0]));
		}
		const parameterCountMap = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };
		const parameterArity = parameterCountMap[uppercaseCommand];
		if (!parameterArity) continue;

		for (let tokenIndex = 0; tokenIndex < numericTokens.length; tokenIndex += parameterArity) {
			const parameterSlice = numericTokens.slice(tokenIndex, tokenIndex + parameterArity);
			if (parameterSlice.length < parameterArity) break;
			let effectiveCommand = commandCharacter;
			if (tokenIndex > 0 && commandCharacter === 'M') effectiveCommand = 'L';
			if (tokenIndex > 0 && commandCharacter === 'm') effectiveCommand = 'l';
			parsedSegments.push({ command: effectiveCommand, parameters: parameterSlice });
		}
	}
	return parsedSegments;
}

export function convertSegmentsToAbsolute(segmentsList) {
	let currentX = ExactRational.ZERO;
	let currentY = ExactRational.ZERO;
	let subpathStartX = ExactRational.ZERO;
	let subpathStartY = ExactRational.ZERO;
	const absoluteSegments = [];

	for (const segment of segmentsList) {
		const uppercaseCommand = segment.command.toUpperCase();
		const isRelative = segment.command !== uppercaseCommand;
		const parameters = segment.parameters;

		switch (uppercaseCommand) {
			case 'M': {
				currentX = isRelative ? currentX.add(parameters[0]) : parameters[0];
				currentY = isRelative ? currentY.add(parameters[1]) : parameters[1];
				subpathStartX = currentX;
				subpathStartY = currentY;
				absoluteSegments.push({ command: 'M', parameters: [currentX, currentY] });
				break;
			}
			case 'L':
			case 'T': {
				currentX = isRelative ? currentX.add(parameters[0]) : parameters[0];
				currentY = isRelative ? currentY.add(parameters[1]) : parameters[1];
				absoluteSegments.push({ command: uppercaseCommand, parameters: [currentX, currentY] });
				break;
			}
			case 'H': {
				currentX = isRelative ? currentX.add(parameters[0]) : parameters[0];
				absoluteSegments.push({ command: 'H', parameters: [currentX] });
				break;
			}
			case 'V': {
				currentY = isRelative ? currentY.add(parameters[0]) : parameters[0];
				absoluteSegments.push({ command: 'V', parameters: [currentY] });
				break;
			}
			case 'C': {
				const controlOneX = isRelative ? currentX.add(parameters[0]) : parameters[0];
				const controlOneY = isRelative ? currentY.add(parameters[1]) : parameters[1];
				const controlTwoX = isRelative ? currentX.add(parameters[2]) : parameters[2];
				const controlTwoY = isRelative ? currentY.add(parameters[3]) : parameters[3];
				currentX = isRelative ? currentX.add(parameters[4]) : parameters[4];
				currentY = isRelative ? currentY.add(parameters[5]) : parameters[5];
				absoluteSegments.push({
					command: 'C',
					parameters: [controlOneX, controlOneY, controlTwoX, controlTwoY, currentX, currentY]
				});
				break;
			}
			case 'S':
			case 'Q': {
				const controlX = isRelative ? currentX.add(parameters[0]) : parameters[0];
				const controlY = isRelative ? currentY.add(parameters[1]) : parameters[1];
				currentX = isRelative ? currentX.add(parameters[2]) : parameters[2];
				currentY = isRelative ? currentY.add(parameters[3]) : parameters[3];
				absoluteSegments.push({
					command: uppercaseCommand,
					parameters: [controlX, controlY, currentX, currentY]
				});
				break;
			}
			case 'A': {
				currentX = isRelative ? currentX.add(parameters[5]) : parameters[5];
				currentY = isRelative ? currentY.add(parameters[6]) : parameters[6];
				absoluteSegments.push({
					command: 'A',
					parameters: [
						parameters[0], parameters[1], parameters[2],
						parameters[3], parameters[4], currentX, currentY
					]
				});
				break;
			}
			case 'Z': {
				currentX = subpathStartX;
				currentY = subpathStartY;
				absoluteSegments.push({ command: 'Z', parameters: [] });
				break;
			}
		}
	}
	return absoluteSegments;
}

export function convertSegmentsToRelative(segmentsList) {
	const absoluteSegments = convertSegmentsToAbsolute(segmentsList);
	let currentX = ExactRational.ZERO;
	let currentY = ExactRational.ZERO;
	let subpathStartX = ExactRational.ZERO;
	let subpathStartY = ExactRational.ZERO;
	const relativeSegments = [];

	for (const segment of absoluteSegments) {
		const parameters = segment.parameters;
		switch (segment.command) {
			case 'M': {
				const deltaX = parameters[0].subtract(currentX);
				const deltaY = parameters[1].subtract(currentY);
				currentX = parameters[0];
				currentY = parameters[1];
				subpathStartX = currentX;
				subpathStartY = currentY;
				relativeSegments.push({ command: 'm', parameters: [deltaX, deltaY] });
				break;
			}
			case 'L':
			case 'T': {
				const deltaX = parameters[0].subtract(currentX);
				const deltaY = parameters[1].subtract(currentY);
				currentX = parameters[0];
				currentY = parameters[1];
				relativeSegments.push({ command: segment.command.toLowerCase(), parameters: [deltaX, deltaY] });
				break;
			}
			case 'H': {
				const deltaX = parameters[0].subtract(currentX);
				currentX = parameters[0];
				relativeSegments.push({ command: 'h', parameters: [deltaX] });
				break;
			}
			case 'V': {
				const deltaY = parameters[0].subtract(currentY);
				currentY = parameters[0];
				relativeSegments.push({ command: 'v', parameters: [deltaY] });
				break;
			}
			case 'C': {
				const deltaOneX = parameters[0].subtract(currentX);
				const deltaOneY = parameters[1].subtract(currentY);
				const deltaTwoX = parameters[2].subtract(currentX);
				const deltaTwoY = parameters[3].subtract(currentY);
				const deltaEndX = parameters[4].subtract(currentX);
				const deltaEndY = parameters[5].subtract(currentY);
				currentX = parameters[4];
				currentY = parameters[5];
				relativeSegments.push({
					command: 'c',
					parameters: [deltaOneX, deltaOneY, deltaTwoX, deltaTwoY, deltaEndX, deltaEndY]
				});
				break;
			}
			case 'S':
			case 'Q': {
				const deltaControlX = parameters[0].subtract(currentX);
				const deltaControlY = parameters[1].subtract(currentY);
				const deltaEndX = parameters[2].subtract(currentX);
				const deltaEndY = parameters[3].subtract(currentY);
				currentX = parameters[2];
				currentY = parameters[3];
				relativeSegments.push({
					command: segment.command.toLowerCase(),
					parameters: [deltaControlX, deltaControlY, deltaEndX, deltaEndY]
				});
				break;
			}
			case 'A': {
				const deltaEndX = parameters[5].subtract(currentX);
				const deltaEndY = parameters[6].subtract(currentY);
				currentX = parameters[5];
				currentY = parameters[6];
				relativeSegments.push({
					command: 'a',
					parameters: [
						parameters[0], parameters[1], parameters[2],
						parameters[3], parameters[4], deltaEndX, deltaEndY
					]
				});
				break;
			}
			case 'Z': {
				currentX = subpathStartX;
				currentY = subpathStartY;
				relativeSegments.push({ command: 'z', parameters: [] });
				break;
			}
		}
	}
	return relativeSegments;
}

export function serializeSegments(segmentsList, roundingDecimalPlaces = null) {
	return segmentsList
		.map((segment) => {
			if (!segment.parameters || segment.parameters.length === 0) {
				return segment.command;
			}
			PrecisionDisclaimerRegistry.setEvaluationContext(
				PrecisionDisclaimerRegistry.currentElementContext,
				`path command '${segment.command}' serialization`
			);
			const serializedParameters = segment.parameters
				.map((parameter) => parameter.toString(roundingDecimalPlaces))
				.join(' ');
			return `${segment.command} ${serializedParameters}`;
		})
		.join(' ');
}

export function translatePathPreservingCommandMode(pathDataString, shiftXValue, shiftYValue) {
	const shiftX = new ExactRational(shiftXValue);
	const shiftY = new ExactRational(shiftYValue);
	if (shiftX.isZero() && shiftY.isZero()) {
		return pathDataString;
	}
	const parsedSegments = parsePathSegments(pathDataString);
	const translatedSegments = [];
	let isInitialMoveSegment = true;

	for (const segment of parsedSegments) {
		const command = segment.command;
		const uppercaseCommand = command.toUpperCase();
		const isAbsolute = command === uppercaseCommand;
		const parameters = segment.parameters;

		if (isInitialMoveSegment && (command === 'M' || command === 'm')) {
			isInitialMoveSegment = false;
			translatedSegments.push({
				command,
				parameters: [parameters[0].add(shiftX), parameters[1].add(shiftY)]
			});
			continue;
		}
		if (!isAbsolute) {
			translatedSegments.push({ command, parameters: [...parameters] });
			continue;
		}
		switch (uppercaseCommand) {
			case 'M':
			case 'L':
			case 'T':
				translatedSegments.push({
					command,
					parameters: [parameters[0].add(shiftX), parameters[1].add(shiftY)]
				});
				break;
			case 'H':
				translatedSegments.push({ command, parameters: [parameters[0].add(shiftX)] });
				break;
			case 'V':
				translatedSegments.push({ command, parameters: [parameters[0].add(shiftY)] });
				break;
			case 'C':
				translatedSegments.push({
					command,
					parameters: [
						parameters[0].add(shiftX), parameters[1].add(shiftY),
						parameters[2].add(shiftX), parameters[3].add(shiftY),
						parameters[4].add(shiftX), parameters[5].add(shiftY)
					]
				});
				break;
			case 'S':
			case 'Q':
				translatedSegments.push({
					command,
					parameters: [
						parameters[0].add(shiftX), parameters[1].add(shiftY),
						parameters[2].add(shiftX), parameters[3].add(shiftY)
					]
				});
				break;
			case 'A':
				translatedSegments.push({
					command,
					parameters: [
						parameters[0], parameters[1], parameters[2],
						parameters[3], parameters[4],
						parameters[5].add(shiftX), parameters[6].add(shiftY)
					]
				});
				break;
			case 'Z':
				translatedSegments.push({ command, parameters: [] });
				break;
		}
	}
	return serializeSegments(translatedSegments);
}

export function transformPathByMatrix(pathDataString, transformationMatrix, preserveRelativeCasing = false) {
	if (transformationMatrix.isIdentityMatrix()) {
		return pathDataString;
	}
	if (transformationMatrix.isPureTranslationMatrix() && preserveRelativeCasing) {
		return translatePathPreservingCommandMode(
			pathDataString,
			transformationMatrix.componentE,
			transformationMatrix.componentF
		);
	}
	const originalSegments = parsePathSegments(pathDataString);
	const absoluteSegments = convertSegmentsToAbsolute(originalSegments);
	let currentX = ExactRational.ZERO;
	let currentY = ExactRational.ZERO;
	let subpathStartX = ExactRational.ZERO;
	let subpathStartY = ExactRational.ZERO;
	const invertSweep = transformationMatrix.calculateDeterminant().compareTo(ExactRational.ZERO) < 0;

	const transformedAbsolute = absoluteSegments.map((segment) => {
		const parameters = segment.parameters;
		switch (segment.command) {
			case 'M': {
				currentX = parameters[0];
				currentY = parameters[1];
				subpathStartX = currentX;
				subpathStartY = currentY;
				const transformedPoint = transformationMatrix.transformPoint(currentX, currentY);
				return { command: 'M', parameters: [transformedPoint.x, transformedPoint.y] };
			}
			case 'L':
			case 'T': {
				currentX = parameters[0];
				currentY = parameters[1];
				const transformedPoint = transformationMatrix.transformPoint(currentX, currentY);
				return { command: segment.command, parameters: [transformedPoint.x, transformedPoint.y] };
			}
			case 'H': {
				currentX = parameters[0];
				const transformedPoint = transformationMatrix.transformPoint(currentX, currentY);
				if (transformationMatrix.componentB.isZero() && transformationMatrix.componentC.isZero()) {
					return { command: 'H', parameters: [transformedPoint.x] };
				}
				return { command: 'L', parameters: [transformedPoint.x, transformedPoint.y] };
			}
			case 'V': {
				currentY = parameters[0];
				const transformedPoint = transformationMatrix.transformPoint(currentX, currentY);
				if (transformationMatrix.componentB.isZero() && transformationMatrix.componentC.isZero()) {
					return { command: 'V', parameters: [transformedPoint.y] };
				}
				return { command: 'L', parameters: [transformedPoint.x, transformedPoint.y] };
			}
			case 'C': {
				const pointOne = transformationMatrix.transformPoint(parameters[0], parameters[1]);
				const pointTwo = transformationMatrix.transformPoint(parameters[2], parameters[3]);
				currentX = parameters[4];
				currentY = parameters[5];
				const endPoint = transformationMatrix.transformPoint(currentX, currentY);
				return {
					command: 'C',
					parameters: [pointOne.x, pointOne.y, pointTwo.x, pointTwo.y, endPoint.x, endPoint.y]
				};
			}
			case 'S':
			case 'Q': {
				const controlPoint = transformationMatrix.transformPoint(parameters[0], parameters[1]);
				currentX = parameters[2];
				currentY = parameters[3];
				const endPoint = transformationMatrix.transformPoint(currentX, currentY);
				return {
					command: segment.command,
					parameters: [controlPoint.x, controlPoint.y, endPoint.x, endPoint.y]
				};
			}
			case 'A': {
				currentX = parameters[5];
				currentY = parameters[6];
				const endPoint = transformationMatrix.transformPoint(currentX, currentY);
				let sweepFlag = parameters[4];
				if (invertSweep) {
					sweepFlag = sweepFlag.isZero() ? ExactRational.ONE : ExactRational.ZERO;
				}
				let radiusX = parameters[0].absolute();
				let radiusY = parameters[1].absolute();
				if (transformationMatrix.componentB.isZero() && transformationMatrix.componentC.isZero()) {
					radiusX = radiusX.multiply(transformationMatrix.componentA.absolute());
					radiusY = radiusY.multiply(transformationMatrix.componentD.absolute());
				} else {
					PrecisionDisclaimerRegistry.setEvaluationContext(
						PrecisionDisclaimerRegistry.currentElementContext,
						'Elliptical Arc (A) radius scaling under rotated/skewed matrix'
					);
					const scaleX = transformationMatrix.componentA.multiply(transformationMatrix.componentA)
						.add(transformationMatrix.componentB.multiply(transformationMatrix.componentB)).squareRoot();
					const scaleY = transformationMatrix.componentC.multiply(transformationMatrix.componentC)
						.add(transformationMatrix.componentD.multiply(transformationMatrix.componentD)).squareRoot();
					radiusX = radiusX.multiply(scaleX);
					radiusY = radiusY.multiply(scaleY);
				}
				return {
					command: 'A',
					parameters: [radiusX, radiusY, parameters[2], parameters[3], sweepFlag, endPoint.x, endPoint.y]
				};
			}
			case 'Z': {
				currentX = subpathStartX;
				currentY = subpathStartY;
				return { command: 'Z', parameters: [] };
			}
			default:
				return segment;
		}
	});

	if (preserveRelativeCasing) {
		const relativeEquivalent = convertSegmentsToRelative(transformedAbsolute);
		const restoredSegments = transformedAbsolute.map((absoluteSegment, index) => {
			const originalCommand = originalSegments[index] ? originalSegments[index].command : absoluteSegment.command;
			return originalCommand === originalCommand.toLowerCase() ? relativeEquivalent[index] : absoluteSegment;
		});
		return serializeSegments(restoredSegments);
	}
	return serializeSegments(transformedAbsolute);
}

export function translateNativeShapeElementAttributes(shapeElement, shiftXValue, shiftYValue) {
	const shiftX = new ExactRational(shiftXValue);
	const shiftY = new ExactRational(shiftYValue);
	if (shiftX.isZero() && shiftY.isZero()) {
		return;
	}
	PrecisionDisclaimerRegistry.setEvaluationContext(
		PrecisionDisclaimerRegistry.formatDomElementIdentifier(shapeElement),
		'Native shape coordinate translation'
	);
	const tagName = shapeElement.tagName.toLowerCase();
	if (tagName === 'rect' || tagName === 'text' || tagName === 'image' || tagName === 'use') {
		const updatedX = new ExactRational(shapeElement.getAttribute('x') || 0).add(shiftX);
		const updatedY = new ExactRational(shapeElement.getAttribute('y') || 0).add(shiftY);
		shapeElement.setAttribute('x', updatedX.toString());
		shapeElement.setAttribute('y', updatedY.toString());
	} else if (tagName === 'circle' || tagName === 'ellipse') {
		const updatedCenterX = new ExactRational(shapeElement.getAttribute('cx') || 0).add(shiftX);
		const updatedCenterY = new ExactRational(shapeElement.getAttribute('cy') || 0).add(shiftY);
		shapeElement.setAttribute('cx', updatedCenterX.toString());
		shapeElement.setAttribute('cy', updatedCenterY.toString());
	} else if (tagName === 'line') {
		const updatedX1 = new ExactRational(shapeElement.getAttribute('x1') || 0).add(shiftX);
		const updatedY1 = new ExactRational(shapeElement.getAttribute('y1') || 0).add(shiftY);
		const updatedX2 = new ExactRational(shapeElement.getAttribute('x2') || 0).add(shiftX);
		const updatedY2 = new ExactRational(shapeElement.getAttribute('y2') || 0).add(shiftY);
		shapeElement.setAttribute('x1', updatedX1.toString());
		shapeElement.setAttribute('y1', updatedY1.toString());
		shapeElement.setAttribute('x2', updatedX2.toString());
		shapeElement.setAttribute('y2', updatedY2.toString());
	} else if (tagName === 'polyline' || tagName === 'polygon') {
		const pointsAttribute = shapeElement.getAttribute('points') || '';
		const numberRegularExpression = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
		const coordinates = [];
		let match;
		while ((match = numberRegularExpression.exec(pointsAttribute)) !== null) {
			coordinates.push(new ExactRational(match[0]));
		}
		const shiftedPairs = [];
		for (let index = 0; index + 1 < coordinates.length; index += 2) {
			const coordinateX = coordinates[index].add(shiftX).toString();
			const coordinateY = coordinates[index + 1].add(shiftY).toString();
			shiftedPairs.push(`${coordinateX},${coordinateY}`);
		}
		shapeElement.setAttribute('points', shiftedPairs.join(' '));
	}
}

function convertScaledCircleElementToEllipse(circleElement, transformedCenter, radiusX, radiusY, documentContext) {
	const ellipseElement = documentContext.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
	for (const attribute of Array.from(circleElement.attributes)) {
		if (attribute.name !== 'r' && attribute.name !== 'cx' && attribute.name !== 'cy') {
			ellipseElement.setAttribute(attribute.name, attribute.value);
		}
	}
	ellipseElement.setAttribute('cx', transformedCenter.x.toString());
	ellipseElement.setAttribute('cy', transformedCenter.y.toString());
	ellipseElement.setAttribute('rx', radiusX.toString());
	ellipseElement.setAttribute('ry', radiusY.toString());
	circleElement.parentNode.replaceChild(ellipseElement, circleElement);
	return ellipseElement;
}

export function transformNativeShapeElementDirectly(shapeElement, transformationMatrix, documentContext) {
	if (transformationMatrix.isIdentityMatrix()) {
		return shapeElement;
	}
	const elementIdentifier = PrecisionDisclaimerRegistry.formatDomElementIdentifier(shapeElement);
	PrecisionDisclaimerRegistry.setEvaluationContext(elementIdentifier, 'Direct native shape matrix transformation');
	const tagName = shapeElement.tagName.toLowerCase();
	const isAxisAlignedMatrix = transformationMatrix.componentB.isZero() && transformationMatrix.componentC.isZero();

	if (tagName === 'line') {
		const startPoint = transformationMatrix.transformPoint(
			shapeElement.getAttribute('x1') || 0,
			shapeElement.getAttribute('y1') || 0
		);
		const endPoint = transformationMatrix.transformPoint(
			shapeElement.getAttribute('x2') || 0,
			shapeElement.getAttribute('y2') || 0
		);
		shapeElement.setAttribute('x1', startPoint.x.toString());
		shapeElement.setAttribute('y1', startPoint.y.toString());
		shapeElement.setAttribute('x2', endPoint.x.toString());
		shapeElement.setAttribute('y2', endPoint.y.toString());
		return shapeElement;
	}

	if (tagName === 'polyline' || tagName === 'polygon') {
		const pointsAttribute = shapeElement.getAttribute('points') || '';
		const numberRegularExpression = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
		const coordinates = [];
		let match;
		while ((match = numberRegularExpression.exec(pointsAttribute)) !== null) {
			coordinates.push(new ExactRational(match[0]));
		}
		const transformedPairs = [];
		for (let index = 0; index + 1 < coordinates.length; index += 2) {
			const transformedPoint = transformationMatrix.transformPoint(coordinates[index], coordinates[index + 1]);
			transformedPairs.push(`${transformedPoint.x.toString()},${transformedPoint.y.toString()}`);
		}
		shapeElement.setAttribute('points', transformedPairs.join(' '));
		return shapeElement;
	}

	if (tagName === 'circle' && isAxisAlignedMatrix) {
		const transformedCenter = transformationMatrix.transformPoint(
			shapeElement.getAttribute('cx') || 0,
			shapeElement.getAttribute('cy') || 0
		);
		const originalRadius = new ExactRational(shapeElement.getAttribute('r') || 0);
		const scaleX = transformationMatrix.componentA.absolute();
		const scaleY = transformationMatrix.componentD.absolute();

		if (scaleX.compareTo(scaleY) === 0) {
			shapeElement.setAttribute('cx', transformedCenter.x.toString());
			shapeElement.setAttribute('cy', transformedCenter.y.toString());
			shapeElement.setAttribute('r', originalRadius.multiply(scaleX).toString());
			return shapeElement;
		}
		return convertScaledCircleElementToEllipse(
			shapeElement,
			transformedCenter,
			originalRadius.multiply(scaleX),
			originalRadius.multiply(scaleY),
			documentContext
		);
	}

	if (tagName === 'ellipse' && isAxisAlignedMatrix) {
		const transformedCenter = transformationMatrix.transformPoint(
			shapeElement.getAttribute('cx') || 0,
			shapeElement.getAttribute('cy') || 0
		);
		const radiusX = new ExactRational(shapeElement.getAttribute('rx') || 0).multiply(transformationMatrix.componentA.absolute());
		const radiusY = new ExactRational(shapeElement.getAttribute('ry') || 0).multiply(transformationMatrix.componentD.absolute());
		shapeElement.setAttribute('cx', transformedCenter.x.toString());
		shapeElement.setAttribute('cy', transformedCenter.y.toString());
		shapeElement.setAttribute('rx', radiusX.toString());
		shapeElement.setAttribute('ry', radiusY.toString());
		return shapeElement;
	}

	if (tagName === 'rect' && isAxisAlignedMatrix) {
		const originalX = new ExactRational(shapeElement.getAttribute('x') || 0);
		const originalY = new ExactRational(shapeElement.getAttribute('y') || 0);
		const originalWidth = new ExactRational(shapeElement.getAttribute('width') || 0);
		const originalHeight = new ExactRational(shapeElement.getAttribute('height') || 0);

		const firstCorner = transformationMatrix.transformPoint(originalX, originalY);
		const secondCorner = transformationMatrix.transformPoint(originalX.add(originalWidth), originalY.add(originalHeight));

		const newX = ExactRational.minimum(firstCorner.x, secondCorner.x);
		const newY = ExactRational.minimum(firstCorner.y, secondCorner.y);
		const newWidth = firstCorner.x.subtract(secondCorner.x).absolute();
		const newHeight = firstCorner.y.subtract(secondCorner.y).absolute();

		shapeElement.setAttribute('x', newX.toString());
		shapeElement.setAttribute('y', newY.toString());
		shapeElement.setAttribute('width', newWidth.toString());
		shapeElement.setAttribute('height', newHeight.toString());

		if (shapeElement.hasAttribute('rx')) {
			const scaledRx = new ExactRational(shapeElement.getAttribute('rx')).multiply(transformationMatrix.componentA.absolute());
			shapeElement.setAttribute('rx', scaledRx.toString());
		}
		if (shapeElement.hasAttribute('ry')) {
			const scaledRy = new ExactRational(shapeElement.getAttribute('ry')).multiply(transformationMatrix.componentD.absolute());
			shapeElement.setAttribute('ry', scaledRy.toString());
		}
		return shapeElement;
	}

	const existingMatrix = AffineTransformationMatrix.parseTransformAttributeString(
		shapeElement.getAttribute('transform'),
		elementIdentifier
	);
	const combinedMatrix = transformationMatrix.multiplyWithMatrix(existingMatrix);
	const serializedTransform = combinedMatrix.toTransformAttributeString();
	if (serializedTransform) {
		shapeElement.setAttribute('transform', serializedTransform);
	} else {
		shapeElement.removeAttribute('transform');
	}
	return shapeElement;
}

export function convertShapeElementToPathData(shapeElement) {
	const tagName = shapeElement.tagName.toLowerCase();
	PrecisionDisclaimerRegistry.setEvaluationContext(
		PrecisionDisclaimerRegistry.formatDomElementIdentifier(shapeElement),
		`Shapes → Path conversion (<${tagName}>)`
	);
	switch (tagName) {
		case 'rect': {
			const x = new ExactRational(shapeElement.getAttribute('x') || 0);
			const y = new ExactRational(shapeElement.getAttribute('y') || 0);
			const width = new ExactRational(shapeElement.getAttribute('width') || 0);
			const height = new ExactRational(shapeElement.getAttribute('height') || 0);
			const right = x.add(width);
			const bottom = y.add(height);
			const rxAttribute = shapeElement.getAttribute('rx');
			const ryAttribute = shapeElement.getAttribute('ry');
			let radiusX = new ExactRational(rxAttribute !== null ? rxAttribute : (ryAttribute || 0));
			let radiusY = new ExactRational(ryAttribute !== null ? ryAttribute : (rxAttribute || 0));

			if (radiusX.isZero() && radiusY.isZero()) {
				return serializeSegments([
					{ command: 'M', parameters: [x, y] },
					{ command: 'L', parameters: [right, y] },
					{ command: 'L', parameters: [right, bottom] },
					{ command: 'L', parameters: [x, bottom] },
					{ command: 'Z', parameters: [] }
				]);
			}
			const halfWidth = width.divide(ExactRational.TWO);
			const halfHeight = height.divide(ExactRational.TWO);
			if (radiusX.compareTo(halfWidth) > 0) radiusX = halfWidth;
			if (radiusY.compareTo(halfHeight) > 0) radiusY = halfHeight;
			return serializeSegments([
				{ command: 'M', parameters: [x.add(radiusX), y] },
				{ command: 'L', parameters: [right.subtract(radiusX), y] },
				{ command: 'A', parameters: [radiusX, radiusY, ExactRational.ZERO, ExactRational.ZERO, ExactRational.ONE, right, y.add(radiusY)] },
				{ command: 'L', parameters: [right, bottom.subtract(radiusY)] },
				{ command: 'A', parameters: [radiusX, radiusY, ExactRational.ZERO, ExactRational.ZERO, ExactRational.ONE, right.subtract(radiusX), bottom] },
				{ command: 'L', parameters: [x.add(radiusX), bottom] },
				{ command: 'A', parameters: [radiusX, radiusY, ExactRational.ZERO, ExactRational.ZERO, ExactRational.ONE, x, bottom.subtract(radiusY)] },
				{ command: 'L', parameters: [x, y.add(radiusY)] },
				{ command: 'A', parameters: [radiusX, radiusY, ExactRational.ZERO, ExactRational.ZERO, ExactRational.ONE, x.add(radiusX), y] },
				{ command: 'Z', parameters: [] }
			]);
		}
		case 'circle':
		case 'ellipse': {
			const centerX = new ExactRational(shapeElement.getAttribute('cx') || 0);
			const centerY = new ExactRational(shapeElement.getAttribute('cy') || 0);
			const radiusX = new ExactRational(shapeElement.getAttribute(tagName === 'circle' ? 'r' : 'rx') || 0);
			const radiusY = new ExactRational(shapeElement.getAttribute(tagName === 'circle' ? 'r' : 'ry') || 0);
			const leftX = centerX.subtract(radiusX);
			const rightX = centerX.add(radiusX);
			return serializeSegments([
				{ command: 'M', parameters: [leftX, centerY] },
				{ command: 'A', parameters: [radiusX, radiusY, ExactRational.ZERO, ExactRational.ONE, ExactRational.ZERO, rightX, centerY] },
				{ command: 'A', parameters: [radiusX, radiusY, ExactRational.ZERO, ExactRational.ONE, ExactRational.ZERO, leftX, centerY] },
				{ command: 'Z', parameters: [] }
			]);
		}
		case 'line': {
			const x1 = new ExactRational(shapeElement.getAttribute('x1') || 0);
			const y1 = new ExactRational(shapeElement.getAttribute('y1') || 0);
			const x2 = new ExactRational(shapeElement.getAttribute('x2') || 0);
			const y2 = new ExactRational(shapeElement.getAttribute('y2') || 0);
			return serializeSegments([
				{ command: 'M', parameters: [x1, y1] },
				{ command: 'L', parameters: [x2, y2] }
			]);
		}
		case 'polyline':
		case 'polygon': {
			const pointsAttribute = shapeElement.getAttribute('points') || '';
			const numberRegularExpression = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
			const coordinates = [];
			let match;
			while ((match = numberRegularExpression.exec(pointsAttribute)) !== null) {
				coordinates.push(new ExactRational(match[0]));
			}
			const segments = [];
			for (let index = 0; index + 1 < coordinates.length; index += 2) {
				segments.push({
					command: index === 0 ? 'M' : 'L',
					parameters: [coordinates[index], coordinates[index + 1]]
				});
			}
			if (tagName === 'polygon' && segments.length > 0) {
				segments.push({ command: 'Z', parameters: [] });
			}
			return serializeSegments(segments);
		}
		default:
			return null;
	}
}

export function replaceBasicShapeWithPath(element, documentContext) {
	const pathData = convertShapeElementToPathData(element);
	if (pathData === null) {
		return element;
	}
	const pathElement = documentContext.createElementNS('http://www.w3.org/2000/svg', 'path');
	const excludedGeometryAttributes = new Set([
		'x', 'y', 'width', 'height', 'cx', 'cy', 'r', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points'
	]);
	for (const attribute of Array.from(element.attributes)) {
		if (!excludedGeometryAttributes.has(attribute.name)) {
			pathElement.setAttribute(attribute.name, attribute.value);
		}
	}
	pathElement.setAttribute('d', pathData);
	element.parentNode.replaceChild(pathElement, element);
	return pathElement;
}

function evaluateCubicBezierAtParameter(p0, p1, p2, p3, parameterT) {
	const oneMinusT = ExactRational.ONE.subtract(parameterT);
	const term0 = oneMinusT.multiply(oneMinusT).multiply(oneMinusT).multiply(p0);
	const term1 = ExactRational.THREE.multiply(oneMinusT).multiply(oneMinusT).multiply(parameterT).multiply(p1);
	const term2 = ExactRational.THREE.multiply(oneMinusT).multiply(parameterT).multiply(parameterT).multiply(p2);
	const term3 = parameterT.multiply(parameterT).multiply(parameterT).multiply(p3);
	return term0.add(term1).add(term2).add(term3);
}

function findCubicBezierDimensionExtrema(p0, p1, p2, p3) {
	const candidateValues = [p0, p3];
	const coefficientA = p0.negate().add(p1.multiply(ExactRational.THREE)).subtract(p2.multiply(ExactRational.THREE)).add(p3);
	const coefficientB = p0.subtract(p1.multiply(ExactRational.TWO)).add(p2);
	const coefficientC = p1.subtract(p0);

	const isInsideUnitInterval = (parameterT) =>
		parameterT.compareTo(ExactRational.ZERO) > 0 && parameterT.compareTo(ExactRational.ONE) < 0;

	if (coefficientA.isZero()) {
		if (!coefficientB.isZero()) {
			const rootT = coefficientC.negate().divide(coefficientB.multiply(ExactRational.TWO));
			if (isInsideUnitInterval(rootT)) {
				candidateValues.push(evaluateCubicBezierAtParameter(p0, p1, p2, p3, rootT));
			}
		}
		return candidateValues;
	}

	const discriminant = coefficientB.multiply(coefficientB).subtract(coefficientA.multiply(coefficientC));
	if (discriminant.compareTo(ExactRational.ZERO) >= 0) {
		const rootDiscriminant = discriminant.squareRoot(64);
		const rootOne = coefficientB.negate().add(rootDiscriminant).divide(coefficientA);
		const rootTwo = coefficientB.negate().subtract(rootDiscriminant).divide(coefficientA);
		if (isInsideUnitInterval(rootOne)) {
			candidateValues.push(evaluateCubicBezierAtParameter(p0, p1, p2, p3, rootOne));
		}
		if (isInsideUnitInterval(rootTwo)) {
			candidateValues.push(evaluateCubicBezierAtParameter(p0, p1, p2, p3, rootTwo));
		}
	}
	return candidateValues;
}

function evaluateQuadraticBezierExtrema(p0, p1, p2) {
	const candidateValues = [p0, p2];
	const denominator = p0.subtract(p1.multiply(ExactRational.TWO)).add(p2);
	if (!denominator.isZero()) {
		const parameterT = p0.subtract(p1).divide(denominator);
		if (parameterT.compareTo(ExactRational.ZERO) > 0 && parameterT.compareTo(ExactRational.ONE) < 0) {
			const oneMinusT = ExactRational.ONE.subtract(parameterT);
			const extremum = oneMinusT.multiply(oneMinusT).multiply(p0)
				.add(ExactRational.TWO.multiply(oneMinusT).multiply(parameterT).multiply(p1))
				.add(parameterT.multiply(parameterT).multiply(p2));
			candidateValues.push(extremum);
		}
	}
	return candidateValues;
}

export function calculateExactAnalyticalBoundingBox(rootElement, ignoreRootTransform = true) {
	let minimumX = null;
	let minimumY = null;
	let maximumX = null;
	let maximumY = null;

	const expandBounds = (xValue, yValue) => {
		if (minimumX === null || xValue.compareTo(minimumX) < 0) minimumX = xValue;
		if (maximumX === null || xValue.compareTo(maximumX) > 0) maximumX = xValue;
		if (minimumY === null || yValue.compareTo(minimumY) < 0) minimumY = yValue;
		if (maximumY === null || yValue.compareTo(maximumY) > 0) maximumY = yValue;
	};

	const traverseElement = (element, accumulatedMatrix, isRootNode) => {
		if (element.nodeType !== Node.ELEMENT_NODE) return;
		const tagName = element.tagName.toLowerCase();
		if (['defs', 'clippath', 'mask', 'metadata', 'title', 'desc', 'style', 'lineargradient', 'radialgradient', 'pattern'].includes(tagName)) {
			return;
		}
		if (element.getAttribute('display') === 'none' || element.getAttribute('visibility') === 'hidden') {
			return;
		}

		const elementDescription = PrecisionDisclaimerRegistry.formatDomElementIdentifier(element);
		let currentMatrix = accumulatedMatrix;
		if (!isRootNode || !ignoreRootTransform) {
			const transformAttribute = element.getAttribute('transform');
			if (transformAttribute) {
				currentMatrix = accumulatedMatrix.multiplyWithMatrix(
					AffineTransformationMatrix.parseTransformAttributeString(transformAttribute, elementDescription)
				);
			}
		}

		let pathDataString = null;
		if (tagName === 'path') {
			pathDataString = element.getAttribute('d');
		} else if (['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon'].includes(tagName)) {
			if ((tagName === 'circle' || tagName === 'ellipse') && currentMatrix.componentB.isZero() && currentMatrix.componentC.isZero()) {
				const cx = new ExactRational(element.getAttribute('cx') || 0);
				const cy = new ExactRational(element.getAttribute('cy') || 0);
				const rx = new ExactRational(element.getAttribute(tagName === 'circle' ? 'r' : 'rx') || 0);
				const ry = new ExactRational(element.getAttribute(tagName === 'circle' ? 'r' : 'ry') || 0);
				const topLeft = currentMatrix.transformPoint(cx.subtract(rx), cy.subtract(ry));
				const bottomRight = currentMatrix.transformPoint(cx.add(rx), cy.add(ry));
				expandBounds(topLeft.x, topLeft.y);
				expandBounds(bottomRight.x, bottomRight.y);
				return;
			}
			pathDataString = convertShapeElementToPathData(element);
		}

		if (pathDataString) {
			PrecisionDisclaimerRegistry.setEvaluationContext(elementDescription, 'Analytical bounding box matrix transform');
			const transformedPathData = transformPathByMatrix(pathDataString, currentMatrix, false);
			const absoluteSegments = convertSegmentsToAbsolute(parsePathSegments(transformedPathData));
			let currentX = ExactRational.ZERO;
			let currentY = ExactRational.ZERO;
			let subpathStartX = ExactRational.ZERO;
			let subpathStartY = ExactRational.ZERO;
			let previousControlX = null;
			let previousControlY = null;

			for (const segment of absoluteSegments) {
				const parameters = segment.parameters;
				switch (segment.command) {
					case 'M':
						currentX = parameters[0];
						currentY = parameters[1];
						subpathStartX = currentX;
						subpathStartY = currentY;
						expandBounds(currentX, currentY);
						previousControlX = null;
						previousControlY = null;
						break;
					case 'L':
					case 'T':
						currentX = parameters[0];
						currentY = parameters[1];
						expandBounds(currentX, currentY);
						previousControlX = null;
						previousControlY = null;
						break;
					case 'H':
						currentX = parameters[0];
						expandBounds(currentX, currentY);
						previousControlX = null;
						previousControlY = null;
						break;
					case 'V':
						currentY = parameters[0];
						expandBounds(currentX, currentY);
						previousControlX = null;
						previousControlY = null;
						break;
					case 'C': {
						PrecisionDisclaimerRegistry.setEvaluationContext(
							elementDescription,
							'Cubic Bezier (C) bounding box extremum B\'(t) = 0'
						);
						const xCandidates = findCubicBezierDimensionExtrema(currentX, parameters[0], parameters[2], parameters[4]);
						const yCandidates = findCubicBezierDimensionExtrema(currentY, parameters[1], parameters[3], parameters[5]);
						for (const xCandidate of xCandidates) expandBounds(xCandidate, currentY);
						for (const yCandidate of yCandidates) expandBounds(currentX, yCandidate);
						previousControlX = parameters[2];
						previousControlY = parameters[3];
						currentX = parameters[4];
						currentY = parameters[5];
						break;
					}
					case 'S': {
						PrecisionDisclaimerRegistry.setEvaluationContext(
							elementDescription,
							'Smooth Cubic Bezier (S) bounding box extremum B\'(t) = 0'
						);
						const reflectedControlX = previousControlX !== null
							? currentX.multiply(ExactRational.TWO).subtract(previousControlX)
							: currentX;
						const reflectedControlY = previousControlY !== null
							? currentY.multiply(ExactRational.TWO).subtract(previousControlY)
							: currentY;
						const xCandidates = findCubicBezierDimensionExtrema(currentX, reflectedControlX, parameters[0], parameters[2]);
						const yCandidates = findCubicBezierDimensionExtrema(currentY, reflectedControlY, parameters[1], parameters[3]);
						for (const xCandidate of xCandidates) expandBounds(xCandidate, currentY);
						for (const yCandidate of yCandidates) expandBounds(currentX, yCandidate);
						previousControlX = parameters[0];
						previousControlY = parameters[1];
						currentX = parameters[2];
						currentY = parameters[3];
						break;
					}
					case 'Q': {
						PrecisionDisclaimerRegistry.setEvaluationContext(
							elementDescription,
							'Quadratic Bezier (Q) bounding box extremum B\'(t) = 0'
						);
						const xCandidates = evaluateQuadraticBezierExtrema(currentX, parameters[0], parameters[2]);
						const yCandidates = evaluateQuadraticBezierExtrema(currentY, parameters[1], parameters[3]);
						for (const xCandidate of xCandidates) expandBounds(xCandidate, currentY);
						for (const yCandidate of yCandidates) expandBounds(currentX, yCandidate);
						previousControlX = parameters[0];
						previousControlY = parameters[1];
						currentX = parameters[2];
						currentY = parameters[3];
						break;
					}
					case 'A': {
						currentX = parameters[5];
						currentY = parameters[6];
						expandBounds(currentX, currentY);
						previousControlX = null;
						previousControlY = null;
						break;
					}
					case 'Z':
						currentX = subpathStartX;
						currentY = subpathStartY;
						previousControlX = null;
						previousControlY = null;
						break;
				}
			}
		}

		for (const childElement of Array.from(element.children)) {
			traverseElement(childElement, currentMatrix, false);
		}
	};

	traverseElement(rootElement, AffineTransformationMatrix.createIdentityMatrix(), true);

	if (minimumX === null || minimumY === null || maximumX === null || maximumY === null) {
		return null;
	}
	return {
		x: minimumX,
		y: minimumY,
		width: maximumX.subtract(minimumX),
		height: maximumY.subtract(minimumY)
	};
}

export const PathGeometryEngine = {
	parsePathSegments,
	convertSegmentsToAbsolute,
	convertSegmentsToRelative,
	serializeSegments,
	translatePathPreservingCommandMode,
	transformPathByMatrix,
	translateNativeShapeElementAttributes,
	transformNativeShapeElementDirectly,
	convertShapeElementToPathData,
	replaceBasicShapeWithPath,
	calculateExactAnalyticalBoundingBox
};

export function parseSvgDocumentStrict(rawSvgInput) {
	let normalizedInput = rawSvgInput.trim();
	if (!normalizedInput.includes('<svg') && normalizedInput.startsWith('<path')) {
		normalizedInput = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>${normalizedInput}</svg>`;
	} else if (!normalizedInput.startsWith('<') && /^[Mm]/.test(normalizedInput)) {
		normalizedInput = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='${normalizedInput}'/></svg>`;
	}
	const domParser = new DOMParser();
	const parsedDocument = domParser.parseFromString(normalizedInput, 'image/svg+xml');
	const parserErrorElement = parsedDocument.querySelector('parsererror');
	if (parserErrorElement) {
		throw new Error('Invalid SVG syntax: ' + parserErrorElement.textContent.slice(0, 120));
	}
	const svgRootElement = parsedDocument.documentElement;
	if (!svgRootElement || svgRootElement.tagName.toLowerCase() !== 'svg') {
		throw new Error('Root element must be an <svg> tag.');
	}
	if (!svgRootElement.getAttribute('xmlns')) {
		svgRootElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
	}
	return { parsedDocument, svgRootElement };
}