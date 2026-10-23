import { AffineTransformationMatrix } from './exact-mathematics.js';
import { PathGeometryEngine } from './path-geometry.js';

const BASIC_SHAPE_TAG_NAMES = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']);
const DEFINITION_CONTAINER_TAG_NAMES = new Set(['defs', 'clippath', 'mask', 'pattern', 'symbol', 'marker', 'lineargradient', 'radialgradient']);
const SCALABLE_STYLE_PROPERTY_NAMES = ['stroke-width', 'stroke-dasharray', 'stroke-dashoffset'];

class ExactRationalNumber {
	constructor(numerator, denominator = 1n) {
		const normalizedNumerator = typeof numerator === 'bigint' ? numerator : BigInt(numerator);
		const normalizedDenominator = typeof denominator === 'bigint' ? denominator : BigInt(denominator);
		if (normalizedDenominator === 0n) {
			throw new Error('Zero denominator is not permitted in ExactRationalNumber.');
		}
		const signMultiplier = normalizedDenominator < 0n ? -1n : 1n;
		const signedNumerator = normalizedNumerator * signMultiplier;
		const positiveDenominator = normalizedDenominator * signMultiplier;
		const greatestCommonDivisor = ExactRationalNumber.calculateGreatestCommonDivisor(
			ExactRationalNumber.calculateAbsoluteBigInt(signedNumerator),
			positiveDenominator
		);
		this.numerator = signedNumerator / greatestCommonDivisor;
		this.denominator = positiveDenominator / greatestCommonDivisor;
	}

	static calculateAbsoluteBigInt(value) {
		return value < 0n ? -value : value;
	}

	static calculateGreatestCommonDivisor(firstValue, secondValue) {
		let leftValue = firstValue;
		let rightValue = secondValue;
		while (rightValue !== 0n) {
			const remainder = leftValue % rightValue;
			leftValue = rightValue;
			rightValue = remainder;
		}
		return leftValue === 0n ? 1n : leftValue;
	}

	static fromNumberOrString(rawInput) {
		if (rawInput === null || rawInput === undefined) {
			throw new Error('Cannot parse null or undefined as ExactRationalNumber.');
		}
		const trimmedInput = String(rawInput).trim();
		if (trimmedInput.length === 0) {
			throw new Error('Cannot parse empty string as ExactRationalNumber.');
		}
		const scientificMatch = /^([+-]?(?:\d+\.?\d*|\.\d+))[eE]([+-]?\d+)$/.exec(trimmedInput);
		if (scientificMatch) {
			const mantissaRational = ExactRationalNumber.fromNumberOrString(scientificMatch[1]);
			const exponentValue = parseInt(scientificMatch[2], 10);
			if (exponentValue >= 0) {
				const multiplier = 10n ** BigInt(exponentValue);
				return new ExactRationalNumber(mantissaRational.numerator * multiplier, mantissaRational.denominator);
			}
			const divisor = 10n ** BigInt(-exponentValue);
			return new ExactRationalNumber(mantissaRational.numerator, mantissaRational.denominator * divisor);
		}
		const decimalMatch = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(trimmedInput);
		if (!decimalMatch) {
			throw new Error('Invalid numeric format for ExactRationalNumber: ' + trimmedInput);
		}
		const signCharacter = decimalMatch[1];
		const rawIntegerDigits = decimalMatch[2] || '';
		const fractionalDigits = decimalMatch[3] || '';
		if (rawIntegerDigits.length === 0 && fractionalDigits.length === 0) {
			throw new Error('Invalid numeric format lacking digits for ExactRationalNumber: ' + trimmedInput);
		}
		const integerDigits = rawIntegerDigits || '0';
		const combinedDigits = integerDigits + fractionalDigits;
		const unsignedNumerator = BigInt(combinedDigits);
		const signedNumerator = signCharacter === '-' ? -unsignedNumerator : unsignedNumerator;
		const powerOfTenDenominator = 10n ** BigInt(fractionalDigits.length);
		return new ExactRationalNumber(signedNumerator, powerOfTenDenominator);
	}

	add(otherRational) {
		return new ExactRationalNumber(
			this.numerator * otherRational.denominator + otherRational.numerator * this.denominator,
			this.denominator * otherRational.denominator
		);
	}

	subtract(otherRational) {
		return new ExactRationalNumber(
			this.numerator * otherRational.denominator - otherRational.numerator * this.denominator,
			this.denominator * otherRational.denominator
		);
	}

	multiply(otherRational) {
		return new ExactRationalNumber(
			this.numerator * otherRational.numerator,
			this.denominator * otherRational.denominator
		);
	}

	divide(otherRational) {
		if (otherRational.numerator === 0n) {
			throw new Error('Division by zero in ExactRationalNumber.');
		}
		return new ExactRationalNumber(
			this.numerator * otherRational.denominator,
			this.denominator * otherRational.numerator
		);
	}

	negate() {
		return new ExactRationalNumber(-this.numerator, this.denominator);
	}

	equals(otherRational) {
		return this.numerator === otherRational.numerator && this.denominator === otherRational.denominator;
	}

	isZero() {
		return this.numerator === 0n;
	}

	toFloatingPointNumber() {
		return Number(this.numerator) / Number(this.denominator);
	}

	toDecimalString(maximumFractionDigits = 16) {
		if (this.numerator === 0n) {
			return '0';
		}
		const isNegative = this.numerator < 0n;
		const absoluteNumerator = ExactRationalNumber.calculateAbsoluteBigInt(this.numerator);
		const integerPart = absoluteNumerator / this.denominator;
		const remainder = absoluteNumerator % this.denominator;
		if (remainder === 0n) {
			return (isNegative ? '-' : '') + integerPart.toString();
		}
		const scaleFactor = 10n ** BigInt(maximumFractionDigits);
		const scaledFraction = (remainder * scaleFactor * 2n + this.denominator) / (this.denominator * 2n);
		if (scaledFraction >= scaleFactor) {
			const incrementedIntegerPart = integerPart + 1n;
			return (isNegative ? '-' : '') + incrementedIntegerPart.toString();
		}
		const paddedFractionDigits = scaledFraction.toString().padStart(maximumFractionDigits, '0');
		const trimmedFractionDigits = paddedFractionDigits.replace(/0+$/, '');
		if (trimmedFractionDigits.length === 0) {
			return (isNegative ? '-' : '') + integerPart.toString();
		}
		return (isNegative ? '-' : '') + integerPart.toString() + '.' + trimmedFractionDigits;
	}
}

function extractRationalMatrixComponents(affineMatrixInstance) {
	const basisProbePath = 'M 0 0 L 1 0 L 0 1';
	const transformedProbePath = PathGeometryEngine.transformPathByMatrix(basisProbePath, affineMatrixInstance, false);
	const numericTokens = transformedProbePath.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
	if (!numericTokens || numericTokens.length < 6) {
		throw new Error('Failed to extract affine matrix components from transformed basis probe path.');
	}
	const originHorizontal = ExactRationalNumber.fromNumberOrString(numericTokens[0]);
	const originVertical = ExactRationalNumber.fromNumberOrString(numericTokens[1]);
	const unitHorizontalTransformedX = ExactRationalNumber.fromNumberOrString(numericTokens[2]);
	const unitHorizontalTransformedY = ExactRationalNumber.fromNumberOrString(numericTokens[3]);
	const unitVerticalTransformedX = ExactRationalNumber.fromNumberOrString(numericTokens[4]);
	const unitVerticalTransformedY = ExactRationalNumber.fromNumberOrString(numericTokens[5]);

	return {
		componentA: unitHorizontalTransformedX.subtract(originHorizontal),
		componentB: unitHorizontalTransformedY.subtract(originVertical),
		componentC: unitVerticalTransformedX.subtract(originHorizontal),
		componentD: unitVerticalTransformedY.subtract(originVertical),
		componentE: originHorizontal,
		componentF: originVertical
	};
}

function isIdentityMatrixComponents(matrixComponents) {
	const oneRational = new ExactRationalNumber(1n, 1n);
	return (
		matrixComponents.componentA.equals(oneRational) &&
		matrixComponents.componentB.isZero() &&
		matrixComponents.componentC.isZero() &&
		matrixComponents.componentD.equals(oneRational) &&
		matrixComponents.componentE.isZero() &&
		matrixComponents.componentF.isZero()
	);
}

function calculateMatrixDecompositionMetrics(matrixComponents) {
	const aSquaredPlusBSquared = matrixComponents.componentA.multiply(matrixComponents.componentA).add(
		matrixComponents.componentB.multiply(matrixComponents.componentB)
	);
	const cSquaredPlusDSquared = matrixComponents.componentC.multiply(matrixComponents.componentC).add(
		matrixComponents.componentD.multiply(matrixComponents.componentD)
	);
	const determinantRational = matrixComponents.componentA.multiply(matrixComponents.componentD).subtract(
		matrixComponents.componentB.multiply(matrixComponents.componentC)
	);
	const dotProductOrthogonality = matrixComponents.componentA.multiply(matrixComponents.componentC).add(
		matrixComponents.componentB.multiply(matrixComponents.componentD)
	);
	const scaleHorizontalFloat = Math.sqrt(aSquaredPlusBSquared.toFloatingPointNumber());
	const scaleVerticalFloat = Math.sqrt(cSquaredPlusDSquared.toFloatingPointNumber());
	const averageScaleFloat = Math.sqrt((aSquaredPlusBSquared.toFloatingPointNumber() + cSquaredPlusDSquared.toFloatingPointNumber()) / 2);
	const rotationAngleRadians = Math.atan2(
		matrixComponents.componentB.toFloatingPointNumber(),
		matrixComponents.componentA.toFloatingPointNumber()
	);
	const rotationAngleDegrees = rotationAngleRadians * (180 / Math.PI);
	const isConformalOrientationPreserving =
		determinantRational.toFloatingPointNumber() > 0 &&
		Math.abs(dotProductOrthogonality.toFloatingPointNumber()) <= 1e-6 * aSquaredPlusBSquared.toFloatingPointNumber() &&
		Math.abs(scaleHorizontalFloat - scaleVerticalFloat) <= 1e-6 * Math.max(1, scaleHorizontalFloat);

	return {
		scaleHorizontalRational: ExactRationalNumber.fromNumberOrString(scaleHorizontalFloat.toPrecision(15)),
		averageScaleRational: ExactRationalNumber.fromNumberOrString(averageScaleFloat.toPrecision(15)),
		rotationAngleDegreesRational: ExactRationalNumber.fromNumberOrString(rotationAngleDegrees.toPrecision(15)),
		isConformalOrientationPreserving
	};
}

function transformPointWithRationalComponents(horizontalCoordinate, verticalCoordinate, matrixComponents) {
	const transformedHorizontal = matrixComponents.componentA
		.multiply(horizontalCoordinate)
		.add(matrixComponents.componentC.multiply(verticalCoordinate))
		.add(matrixComponents.componentE);
	const transformedVertical = matrixComponents.componentB
		.multiply(horizontalCoordinate)
		.add(matrixComponents.componentD.multiply(verticalCoordinate))
		.add(matrixComponents.componentF);
	return {
		horizontal: transformedHorizontal,
		vertical: transformedVertical
	};
}

function scaleNumericValueTokenWithUnit(rawTokenString, scaleFactorRational) {
	const trimmedToken = rawTokenString.trim();
	if (trimmedToken === '' || trimmedToken === 'none' || trimmedToken === 'inherit') {
		return trimmedToken;
	}
	const tokenMatch = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)([a-zA-Z%]*)$/.exec(trimmedToken);
	if (!tokenMatch) {
		return trimmedToken;
	}
	const numericPartRational = ExactRationalNumber.fromNumberOrString(tokenMatch[1]);
	const unitSuffix = tokenMatch[2] || '';
	if (unitSuffix === '%') {
		return trimmedToken;
	}
	const scaledRational = numericPartRational.multiply(scaleFactorRational);
	return scaledRational.toDecimalString() + unitSuffix;
}

function scaleSpaceOrCommaSeparatedValueList(rawListString, scaleFactorRational) {
	const trimmedList = rawListString.trim();
	if (trimmedList === '' || trimmedList === 'none') {
		return trimmedList;
	}
	return trimmedList
		.split(/(\s+|\s*,\s*)/)
		.map((segment) => {
			if (/^(\s+|\s*,\s*)$/.test(segment)) {
				return segment;
			}
			return scaleNumericValueTokenWithUnit(segment, scaleFactorRational);
		})
		.join('');
}

function parseInlineStyleDeclarations(styleAttributeString) {
	const styleMap = new Map();
	if (!styleAttributeString) {
		return styleMap;
	}
	const declarationList = styleAttributeString.split(';');
	for (const declarationEntry of declarationList) {
		const colonIndex = declarationEntry.indexOf(':');
		if (colonIndex === -1) {
			continue;
		}
		const propertyName = declarationEntry.slice(0, colonIndex).trim().toLowerCase();
		const propertyValue = declarationEntry.slice(colonIndex + 1).trim();
		if (propertyName.length > 0) {
			styleMap.set(propertyName, propertyValue);
		}
	}
	return styleMap;
}

function serializeInlineStyleDeclarations(styleMap) {
	const serializedEntries = [];
	for (const [propertyName, propertyValue] of styleMap.entries()) {
		serializedEntries.push(propertyName + ':' + propertyValue);
	}
	return serializedEntries.join(';');
}

function scaleElementStrokeAndPresentationProperties(targetElement, scaleFactorRational) {
	const oneRational = new ExactRationalNumber(1n, 1n);
	if (scaleFactorRational.equals(oneRational)) {
		return;
	}
	for (const propertyName of SCALABLE_STYLE_PROPERTY_NAMES) {
		if (targetElement.hasAttribute(propertyName)) {
			const originalAttributeValue = targetElement.getAttribute(propertyName);
			const scaledAttributeValue = scaleSpaceOrCommaSeparatedValueList(originalAttributeValue, scaleFactorRational);
			targetElement.setAttribute(propertyName, scaledAttributeValue);
		}
	}
	if (targetElement.hasAttribute('style')) {
		const styleMap = parseInlineStyleDeclarations(targetElement.getAttribute('style'));
		let styleWasModified = false;
		for (const propertyName of SCALABLE_STYLE_PROPERTY_NAMES) {
			if (styleMap.has(propertyName)) {
				const originalStyleValue = styleMap.get(propertyName);
				const scaledStyleValue = scaleSpaceOrCommaSeparatedValueList(originalStyleValue, scaleFactorRational);
				styleMap.set(propertyName, scaledStyleValue);
				styleWasModified = true;
			}
		}
		if (styleWasModified) {
			targetElement.setAttribute('style', serializeInlineStyleDeclarations(styleMap));
		}
	}
}

function parseCoordinateNumberList(attributeValueString) {
	if (!attributeValueString || attributeValueString.trim().length === 0) {
		return [];
	}
	const matchedTokens = attributeValueString.trim().match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
	if (!matchedTokens) {
		return [];
	}
	return matchedTokens.map((token) => ExactRationalNumber.fromNumberOrString(token));
}

function scaleElementFontSizeProperty(textOrTspanElement, scaleFactorRational) {
	const oneRational = new ExactRationalNumber(1n, 1n);
	if (scaleFactorRational.equals(oneRational)) {
		return;
	}
	if (textOrTspanElement.hasAttribute('font-size')) {
		const scaledAttributeFontSize = scaleNumericValueTokenWithUnit(
			textOrTspanElement.getAttribute('font-size'),
			scaleFactorRational
		);
		textOrTspanElement.setAttribute('font-size', scaledAttributeFontSize);
	}
	if (textOrTspanElement.hasAttribute('style')) {
		const styleMap = parseInlineStyleDeclarations(textOrTspanElement.getAttribute('style'));
		if (styleMap.has('font-size')) {
			const scaledStyleFontSize = scaleNumericValueTokenWithUnit(styleMap.get('font-size'), scaleFactorRational);
			styleMap.set('font-size', scaledStyleFontSize);
			textOrTspanElement.setAttribute('style', serializeInlineStyleDeclarations(styleMap));
		}
	}
}

function transformTextPositioningElementCoordinates(positioningElement, matrixComponents, scaleFactorRational, rotationAngleDegreesRational, canBakeRotationIntoGlyphs) {
	const horizontalCoordinates = parseCoordinateNumberList(positioningElement.getAttribute('x'));
	const verticalCoordinates = parseCoordinateNumberList(positioningElement.getAttribute('y'));
	const horizontalOffsets = parseCoordinateNumberList(positioningElement.getAttribute('dx'));
	const verticalOffsets = parseCoordinateNumberList(positioningElement.getAttribute('dy'));

	if (horizontalOffsets.length > 0) {
		const scaledHorizontalOffsets = horizontalOffsets.map((offsetValue) => offsetValue.multiply(scaleFactorRational).toDecimalString());
		positioningElement.setAttribute('dx', scaledHorizontalOffsets.join(' '));
	}
	if (verticalOffsets.length > 0) {
		const scaledVerticalOffsets = verticalOffsets.map((offsetValue) => offsetValue.multiply(scaleFactorRational).toDecimalString());
		positioningElement.setAttribute('dy', scaledVerticalOffsets.join(' '));
	}

	const coordinateCount = Math.max(horizontalCoordinates.length, verticalCoordinates.length);
	if (coordinateCount === 0) {
		return;
	}

	const zeroRational = new ExactRationalNumber(0n, 1n);
	const transformedHorizontalList = [];
	const transformedVerticalList = [];

	for (let coordinateIndex = 0; coordinateIndex < coordinateCount; coordinateIndex += 1) {
		const currentHorizontal =
			coordinateIndex < horizontalCoordinates.length
				? horizontalCoordinates[coordinateIndex]
				: horizontalCoordinates.length > 0
					? horizontalCoordinates[horizontalCoordinates.length - 1]
					: zeroRational;
		const currentVertical =
			coordinateIndex < verticalCoordinates.length
				? verticalCoordinates[coordinateIndex]
				: verticalCoordinates.length > 0
					? verticalCoordinates[verticalCoordinates.length - 1]
					: zeroRational;

		if (canBakeRotationIntoGlyphs) {
			const transformedPoint = transformPointWithRationalComponents(currentHorizontal, currentVertical, matrixComponents);
			transformedHorizontalList.push(transformedPoint.horizontal.toDecimalString());
			transformedVerticalList.push(transformedPoint.vertical.toDecimalString());
		} else {
			const originTransformed = transformPointWithRationalComponents(zeroRational, zeroRational, matrixComponents);
			const unrotatedHorizontal = originTransformed.horizontal.add(currentHorizontal.multiply(scaleFactorRational));
			const unrotatedVertical = originTransformed.vertical.add(currentVertical.multiply(scaleFactorRational));
			transformedHorizontalList.push(unrotatedHorizontal.toDecimalString());
			transformedVerticalList.push(unrotatedVertical.toDecimalString());
		}
	}

	positioningElement.setAttribute('x', transformedHorizontalList.join(' '));
	if (canBakeRotationIntoGlyphs) {
		positioningElement.setAttribute('y', transformedVerticalList.join(' '));
	} else if (verticalCoordinates.length > 0) {
		const deduplicatedVerticalList =
			verticalCoordinates.length === 1 ? [transformedVerticalList[0]] : transformedVerticalList;
		positioningElement.setAttribute('y', deduplicatedVerticalList.join(' '));
	}

	if (canBakeRotationIntoGlyphs && !rotationAngleDegreesRational.isZero()) {
		const existingRotations = parseCoordinateNumberList(positioningElement.getAttribute('rotate'));
		const visibleCharacterCount = (positioningElement.textContent || '').length;
		const targetRotationEntryCount = Math.max(coordinateCount, visibleCharacterCount, existingRotations.length, 1);
		const updatedRotationValues = [];
		for (let characterIndex = 0; characterIndex < targetRotationEntryCount; characterIndex += 1) {
			const existingAngle =
				characterIndex < existingRotations.length
					? existingRotations[characterIndex]
					: existingRotations.length > 0
						? existingRotations[existingRotations.length - 1]
						: zeroRational;
			const combinedAngle = existingAngle.add(rotationAngleDegreesRational);
			updatedRotationValues.push(combinedAngle.toDecimalString());
		}
		positioningElement.setAttribute('rotate', updatedRotationValues.join(' '));
	}
}

function hasExplicitCoordinatesForEveryCharacter(textElement) {
	const childTspanElements = Array.from(textElement.querySelectorAll('tspan'));
	const elementsToInspect = childTspanElements.length > 0 ? childTspanElements : [textElement];
	for (const elementToInspect of elementsToInspect) {
		const textLength = (elementToInspect.textContent || '').trim().length;
		if (textLength === 0) {
			continue;
		}
		const horizontalCoordinates = parseCoordinateNumberList(elementToInspect.getAttribute('x'));
		if (horizontalCoordinates.length < textLength) {
			return false;
		}
	}
	return true;
}

function applyResidualTextTransformAttribute(textElement, matrixComponents, decompositionMetrics, scaleFactorRational, rotationAngleDegreesRational) {
	const zeroRational = new ExactRationalNumber(0n, 1n);
	const pivotPoint = transformPointWithRationalComponents(zeroRational, zeroRational, matrixComponents);
	if (decompositionMetrics.isConformalOrientationPreserving && !rotationAngleDegreesRational.isZero()) {
		const rotateTransformString =
			'rotate(' +
			rotationAngleDegreesRational.toDecimalString() +
			' ' +
			pivotPoint.horizontal.toDecimalString() +
			' ' +
			pivotPoint.vertical.toDecimalString() +
			')';
		textElement.setAttribute('transform', rotateTransformString);
		return;
	}
	if (!decompositionMetrics.isConformalOrientationPreserving) {
		const normalizedComponentA = matrixComponents.componentA.divide(scaleFactorRational);
		const normalizedComponentB = matrixComponents.componentB.divide(scaleFactorRational);
		const normalizedComponentC = matrixComponents.componentC.divide(scaleFactorRational);
		const normalizedComponentD = matrixComponents.componentD.divide(scaleFactorRational);
		const residualTranslationX = pivotPoint.horizontal.subtract(
			normalizedComponentA.multiply(pivotPoint.horizontal).add(normalizedComponentC.multiply(pivotPoint.vertical))
		);
		const residualTranslationY = pivotPoint.vertical.subtract(
			normalizedComponentB.multiply(pivotPoint.horizontal).add(normalizedComponentD.multiply(pivotPoint.vertical))
		);
		const residualMatrixString =
			'matrix(' +
			[
				normalizedComponentA.toDecimalString(),
				normalizedComponentB.toDecimalString(),
				normalizedComponentC.toDecimalString(),
				normalizedComponentD.toDecimalString(),
				residualTranslationX.toDecimalString(),
				residualTranslationY.toDecimalString()
			].join(',') +
			')';
		textElement.setAttribute('transform', residualMatrixString);
	}
}

function transformTextElementSubtree(textElement, localMatrix, options) {
	const matrixComponents = extractRationalMatrixComponents(localMatrix);
	if (isIdentityMatrixComponents(matrixComponents)) {
		return;
	}
	const decompositionMetrics = calculateMatrixDecompositionMetrics(matrixComponents);
	const scaleFactorRational = decompositionMetrics.scaleHorizontalRational;
	const rotationAngleDegreesRational = decompositionMetrics.rotationAngleDegreesRational;

	scaleElementFontSizeProperty(textElement, scaleFactorRational);
	scaleElementStrokeAndPresentationProperties(textElement, decompositionMetrics.averageScaleRational);

	const childTspanElements = Array.from(textElement.querySelectorAll('tspan'));
	for (const tspanElement of childTspanElements) {
		scaleElementFontSizeProperty(tspanElement, scaleFactorRational);
		scaleElementStrokeAndPresentationProperties(tspanElement, decompositionMetrics.averageScaleRational);
	}

	const canBakeRotationIntoGlyphs =
		!options.preserveTextRotationAsTransform &&
		decompositionMetrics.isConformalOrientationPreserving &&
		hasExplicitCoordinatesForEveryCharacter(textElement);

	if (textElement.hasAttribute('x') || textElement.hasAttribute('y') || childTspanElements.length === 0) {
		if (!textElement.hasAttribute('x') && childTspanElements.length === 0) {
			textElement.setAttribute('x', '0');
		}
		if (!textElement.hasAttribute('y') && childTspanElements.length === 0) {
			textElement.setAttribute('y', '0');
		}
		transformTextPositioningElementCoordinates(
			textElement,
			matrixComponents,
			scaleFactorRational,
			rotationAngleDegreesRational,
			canBakeRotationIntoGlyphs
		);
	}

	for (const tspanElement of childTspanElements) {
		transformTextPositioningElementCoordinates(
			tspanElement,
			matrixComponents,
			scaleFactorRational,
			rotationAngleDegreesRational,
			canBakeRotationIntoGlyphs
		);
	}

	if (!canBakeRotationIntoGlyphs) {
		applyResidualTextTransformAttribute(
			textElement,
			matrixComponents,
			decompositionMetrics,
			scaleFactorRational,
			rotationAngleDegreesRational
		);
	}
}

function serializeMatrixComponentsKey(matrixComponents) {
	return [
		matrixComponents.componentA.toDecimalString(),
		matrixComponents.componentB.toDecimalString(),
		matrixComponents.componentC.toDecimalString(),
		matrixComponents.componentD.toDecimalString(),
		matrixComponents.componentE.toDecimalString(),
		matrixComponents.componentF.toDecimalString()
	].join('|');
}

function extractReferencedIdentifierFromUrlValue(attributeValue) {
	if (!attributeValue) {
		return null;
	}
	const urlMatch = /url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/.exec(attributeValue);
	return urlMatch ? urlMatch[1] : null;
}

function collectAllReferencedElementIdentifiers(svgRootElement) {
	const referencedIdentifiers = new Set();
	const allElements = [svgRootElement, ...Array.from(svgRootElement.querySelectorAll('*'))];
	for (const element of allElements) {
		for (const attributeNode of Array.from(element.attributes)) {
			if (attributeNode.name === 'id') {
				continue;
			}
			const urlIdentifier = extractReferencedIdentifierFromUrlValue(attributeNode.value);
			if (urlIdentifier) {
				referencedIdentifiers.add(urlIdentifier);
			}
			if ((attributeNode.name === 'href' || attributeNode.name === 'xlink:href') && attributeNode.value.startsWith('#')) {
				referencedIdentifiers.add(attributeNode.value.slice(1));
			}
		}
	}
	return referencedIdentifiers;
}

function unwrapEmptyGroupElement(groupElement, referencedIdentifiers) {
	if (groupElement.tagName.toLowerCase() !== 'g' || !groupElement.parentNode) {
		return;
	}
	const remainingAttributeNames = Array.from(groupElement.attributes).map((attributeNode) => attributeNode.name);
	const hasOnlyUnreferencedId =
		remainingAttributeNames.length === 1 &&
		remainingAttributeNames[0] === 'id' &&
		!referencedIdentifiers.has(groupElement.getAttribute('id'));

	if (remainingAttributeNames.length > 0 && !hasOnlyUnreferencedId) {
		return;
	}
	while (groupElement.firstChild) {
		groupElement.parentNode.insertBefore(groupElement.firstChild, groupElement);
	}
	groupElement.parentNode.removeChild(groupElement);
}

function transformGeometryElementInPlace(currentNode, localMatrix, parsedDocument, options) {
	let targetElement = currentNode;
	const initialTagName = currentNode.tagName.toLowerCase();
	let pathAlreadyTransformedByNativeEngine = false;

	if (BASIC_SHAPE_TAG_NAMES.has(initialTagName)) {
		if (options.convertShapes) {
			targetElement = PathGeometryEngine.replaceBasicShapeWithPath(currentNode, parsedDocument);
		} else {
			targetElement = PathGeometryEngine.transformNativeShapeElementDirectly(currentNode, localMatrix, parsedDocument);
			pathAlreadyTransformedByNativeEngine = true;
		}
	}

	if (targetElement.tagName.toLowerCase() === 'path' && targetElement.hasAttribute('d')) {
		const transformedPathString = pathAlreadyTransformedByNativeEngine
			? targetElement.getAttribute('d')
			: PathGeometryEngine.transformPathByMatrix(targetElement.getAttribute('d'), localMatrix, false);

		if (options.outputRelative) {
			const parsedSegments = PathGeometryEngine.parsePathSegments(transformedPathString);
			const relativeSegments = PathGeometryEngine.convertSegmentsToRelative(parsedSegments);
			targetElement.setAttribute('d', PathGeometryEngine.serializeSegments(relativeSegments));
		} else {
			targetElement.setAttribute('d', transformedPathString);
		}
	}

	const matrixComponents = extractRationalMatrixComponents(localMatrix);
	const decompositionMetrics = calculateMatrixDecompositionMetrics(matrixComponents);
	scaleElementStrokeAndPresentationProperties(targetElement, decompositionMetrics.averageScaleRational);

	return targetElement;
}

function normalizeClipPathContentsRecursively(currentNode, accumulatedMatrix, parsedDocument, options) {
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
	const tagName = currentNode.tagName.toLowerCase();
	if (tagName === 'text') {
		transformTextElementSubtree(currentNode, localMatrix, options);
		return;
	}
	const targetElement = transformGeometryElementInPlace(currentNode, localMatrix, parsedDocument, options);
	for (const childNode of Array.from(targetElement.childNodes)) {
		normalizeClipPathContentsRecursively(childNode, localMatrix, parsedDocument, options);
	}
}

function findClipPathElementByIdentifier(svgRootElement, clipPathIdentifier) {
	const candidateElements = svgRootElement.querySelectorAll('clipPath, clippath');
	for (const candidateElement of Array.from(candidateElements)) {
		if (candidateElement.getAttribute('id') === clipPathIdentifier) {
			return candidateElement;
		}
	}
	return null;
}

function synchronizeReferencedClipPaths(svgRootElement, clipPathUsageRegistry, parsedDocument, options) {
	for (const [clipPathIdentifier, usageEntries] of clipPathUsageRegistry.entries()) {
		const originalClipPathElement = findClipPathElementByIdentifier(svgRootElement, clipPathIdentifier);
		if (!originalClipPathElement) {
			continue;
		}
		const clipPathUnitsValue = originalClipPathElement.getAttribute('clipPathUnits') || 'userSpaceOnUse';
		if (clipPathUnitsValue === 'objectBoundingBox') {
			continue;
		}
		const groupedByMatrixKey = new Map();
		for (const usageEntry of usageEntries) {
			const matrixComponents = extractRationalMatrixComponents(usageEntry.matrix);
			const matrixKey = serializeMatrixComponentsKey(matrixComponents);
			if (!groupedByMatrixKey.has(matrixKey)) {
				groupedByMatrixKey.set(matrixKey, {
					matrix: usageEntry.matrix,
					elements: []
				});
			}
			groupedByMatrixKey.get(matrixKey).elements.push(usageEntry.referencingElement);
		}

		const unmodifiedClipPathTemplate = originalClipPathElement.cloneNode(true);
		let groupIndex = 0;
		for (const matrixGroup of groupedByMatrixKey.values()) {
			if (groupIndex === 0) {
				normalizeClipPathContentsRecursively(originalClipPathElement, matrixGroup.matrix, parsedDocument, options);
			} else {
				const clonedClipPathElement = unmodifiedClipPathTemplate.cloneNode(true);
				const clonedIdentifier = clipPathIdentifier + '_flattened_' + groupIndex;
				clonedClipPathElement.setAttribute('id', clonedIdentifier);
				originalClipPathElement.parentNode.insertBefore(clonedClipPathElement, originalClipPathElement.nextSibling);
				normalizeClipPathContentsRecursively(clonedClipPathElement, matrixGroup.matrix, parsedDocument, options);
				for (const referencingElement of matrixGroup.elements) {
					referencingElement.setAttribute('clip-path', 'url(#' + clonedIdentifier + ')');
				}
			}
			groupIndex += 1;
		}
	}
}

function normalizeElementNodeRecursively(currentNode, accumulatedMatrix, parsedDocument, options, clipPathUsageRegistry, referencedIdentifiers) {
	if (currentNode.nodeType !== Node.ELEMENT_NODE) {
		return;
	}
	const initialTagName = currentNode.tagName.toLowerCase();
	if (DEFINITION_CONTAINER_TAG_NAMES.has(initialTagName)) {
		return;
	}

	let localMatrix = accumulatedMatrix;
	const transformAttribute = currentNode.getAttribute('transform');
	if (transformAttribute) {
		const nodeMatrix = AffineTransformationMatrix.parseTransformAttributeString(transformAttribute);
		localMatrix = accumulatedMatrix.multiplyWithMatrix(nodeMatrix);
		currentNode.removeAttribute('transform');
	}

	if (currentNode.hasAttribute('clip-path')) {
		const clipPathIdentifier = extractReferencedIdentifierFromUrlValue(currentNode.getAttribute('clip-path'));
		if (clipPathIdentifier) {
			if (!clipPathUsageRegistry.has(clipPathIdentifier)) {
				clipPathUsageRegistry.set(clipPathIdentifier, []);
			}
			clipPathUsageRegistry.get(clipPathIdentifier).push({
				referencingElement: currentNode,
				matrix: localMatrix
			});
		}
	}

	if (initialTagName === 'text') {
		transformTextElementSubtree(currentNode, localMatrix, options);
		return;
	}

	const targetElement = transformGeometryElementInPlace(currentNode, localMatrix, parsedDocument, options);

	for (const childNode of Array.from(targetElement.childNodes)) {
		normalizeElementNodeRecursively(childNode, localMatrix, parsedDocument, options, clipPathUsageRegistry, referencedIdentifiers);
	}

	if (options.unwrapTransformedGroups) {
		unwrapEmptyGroupElement(targetElement, referencedIdentifiers);
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
		unwrapTransformedGroups: false,
		preserveTextRotationAsTransform: false
	},
	executeOnDom(svgRootElement, parsedDocument, options) {
		const resolvedOptions = {
			...flattenTransformsToolDefinition.defaultOptions,
			...(options || {})
		};
		const clipPathUsageRegistry = new Map();
		const referencedIdentifiers = collectAllReferencedElementIdentifiers(svgRootElement);
		normalizeElementNodeRecursively(
			svgRootElement,
			AffineTransformationMatrix.createIdentityMatrix(),
			parsedDocument,
			resolvedOptions,
			clipPathUsageRegistry,
			referencedIdentifiers
		);
		synchronizeReferencedClipPaths(svgRootElement, clipPathUsageRegistry, parsedDocument, resolvedOptions);
	}
};
