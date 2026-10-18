const TRIGONOMETRIC_PRECISION_DIGITS = 128;

export class PrecisionDisclaimerRegistry {
	static recordedEventsMap = new Map();
	static currentElementContext = '<svg>';
	static currentOperationContext = 'Coordinate calculation';

	static resetRegistry() {
		this.recordedEventsMap.clear();
		this.currentElementContext = '<svg>';
		this.currentOperationContext = 'Coordinate calculation';
	}

	static setEvaluationContext(elementDescription, operationDescription) {
		if (elementDescription) {
			this.currentElementContext = elementDescription;
		}
		if (operationDescription) {
			this.currentOperationContext = operationDescription;
		}
	}

	static formatDomElementIdentifier(domElement) {
		if (!domElement || !domElement.tagName) {
			return '<svg>';
		}
		const tagName = domElement.tagName.toLowerCase();
		const elementId = domElement.getAttribute('id');
		return elementId ? `<${tagName}#${elementId}>` : `<${tagName}>`;
	}

	static recordApproximationTrigger({ constantSymbol, triggerLocation, mathematicalReason }) {
		const deduplicationKey = `${constantSymbol}|${triggerLocation}|${mathematicalReason}`;
		if (!this.recordedEventsMap.has(deduplicationKey)) {
			this.recordedEventsMap.set(deduplicationKey, {
				constantSymbol,
				triggerLocation,
				mathematicalReason
			});
		}
	}

	static retrieveRecordedTriggers() {
		return Array.from(this.recordedEventsMap.values());
	}
}

function calculateGreatestCommonDivisor(firstBigInt, secondBigInt) {
	let absoluteFirst = firstBigInt < 0n ? -firstBigInt : firstBigInt;
	let absoluteSecond = secondBigInt < 0n ? -secondBigInt : secondBigInt;
	while (absoluteSecond !== 0n) {
		const remainder = absoluteFirst % absoluteSecond;
		absoluteFirst = absoluteSecond;
		absoluteSecond = remainder;
	}
	return absoluteFirst === 0n ? 1n : absoluteFirst;
}

function calculateExactIntegerSquareRoot(positiveBigInt) {
	if (positiveBigInt < 0n) {
		return null;
	}
	if (positiveBigInt === 0n) {
		return 0n;
	}
	if (positiveBigInt === 1n) {
		return 1n;
	}
	const bitLength = BigInt(positiveBigInt.toString(2).length);
	let approximation = 1n << ((bitLength + 1n) >> 1n);
	while (true) {
		const nextApproximation = (approximation + positiveBigInt / approximation) >> 1n;
		if (nextApproximation >= approximation) {
			break;
		}
		approximation = nextApproximation;
	}
	return approximation * approximation === positiveBigInt ? approximation : null;
}

export class ExactRational {
	constructor(numeratorInput = 0n, denominatorInput = 1n) {
		if (numeratorInput instanceof ExactRational) {
			this.numerator = numeratorInput.numerator;
			this.denominator = numeratorInput.denominator;
			return;
		}
		if (typeof numeratorInput === 'bigint' && typeof denominatorInput === 'bigint') {
			if (denominatorInput === 0n) {
				throw new Error('Division by zero in ExactRational initialization.');
			}
			const signFactor = denominatorInput < 0n ? -1n : 1n;
			const normalizedNumerator = numeratorInput * signFactor;
			const normalizedDenominator = denominatorInput * signFactor;
			const commonDivisor = calculateGreatestCommonDivisor(normalizedNumerator, normalizedDenominator);
			this.numerator = normalizedNumerator / commonDivisor;
			this.denominator = normalizedDenominator / commonDivisor;
			return;
		}
		const parsedFraction = ExactRational.parseDecimalStringToFraction(String(numeratorInput));
		this.numerator = parsedFraction.numerator;
		this.denominator = parsedFraction.denominator;
	}

	static createFromRawReduced(numeratorBigInt, denominatorBigInt) {
		const instance = Object.create(ExactRational.prototype);
		instance.numerator = numeratorBigInt;
		instance.denominator = denominatorBigInt;
		return instance;
	}

	static parseDecimalStringToFraction(rawString) {
		let trimmedString = rawString.trim();
		if (trimmedString === '') {
			return { numerator: 0n, denominator: 1n };
		}
		let signMultiplier = 1n;
		if (trimmedString.startsWith('-')) {
			signMultiplier = -1n;
			trimmedString = trimmedString.slice(1);
		} else if (trimmedString.startsWith('+')) {
			trimmedString = trimmedString.slice(1);
		}
		let exponentValue = 0n;
		if (/[eE]/.test(trimmedString)) {
			const exponentParts = trimmedString.split(/[eE]/);
			trimmedString = exponentParts[0];
			exponentValue = BigInt(parseInt(exponentParts[1], 10));
		}
		const decimalParts = trimmedString.split('.');
		const integerPartString = (decimalParts[0] || '0').replace(/[^\d]/g, '') || '0';
		const fractionalPartString = (decimalParts[1] || '').replace(/[^\d]/g, '');
		const combinedDigitsString = integerPartString + fractionalPartString;
		let rawNumerator = BigInt(combinedDigitsString || '0') * signMultiplier;
		let rawDenominator = 10n ** BigInt(fractionalPartString.length);

		if (exponentValue > 0n) {
			rawNumerator *= 10n ** exponentValue;
		} else if (exponentValue < 0n) {
			rawDenominator *= 10n ** (-exponentValue);
		}
		const commonDivisor = calculateGreatestCommonDivisor(rawNumerator, rawDenominator);
		return {
			numerator: rawNumerator / commonDivisor,
			denominator: rawDenominator / commonDivisor
		};
	}

	add(otherValue) {
		const otherRational = otherValue instanceof ExactRational ? otherValue : new ExactRational(otherValue);
		if (this.numerator === 0n) return otherRational;
		if (otherRational.numerator === 0n) return this;
		const combinedNumerator = this.numerator * otherRational.denominator + otherRational.numerator * this.denominator;
		const combinedDenominator = this.denominator * otherRational.denominator;
		return new ExactRational(combinedNumerator, combinedDenominator);
	}

	subtract(otherValue) {
		const otherRational = otherValue instanceof ExactRational ? otherValue : new ExactRational(otherValue);
		return this.add(otherRational.negate());
	}

	multiply(otherValue) {
		const otherRational = otherValue instanceof ExactRational ? otherValue : new ExactRational(otherValue);
		if (this.numerator === 0n || otherRational.numerator === 0n) {
			return ExactRational.ZERO;
		}
		return new ExactRational(
			this.numerator * otherRational.numerator,
			this.denominator * otherRational.denominator
		);
	}

	divide(otherValue) {
		const otherRational = otherValue instanceof ExactRational ? otherValue : new ExactRational(otherValue);
		if (otherRational.numerator === 0n) {
			throw new Error('Division by zero in ExactRational operation.');
		}
		return new ExactRational(
			this.numerator * otherRational.denominator,
			this.denominator * otherRational.numerator
		);
	}

	negate() {
		return ExactRational.createFromRawReduced(-this.numerator, this.denominator);
	}

	absolute() {
		return this.numerator < 0n ? this.negate() : this;
	}

	isZero() {
		return this.numerator === 0n;
	}

	compareTo(otherValue) {
		const otherRational = otherValue instanceof ExactRational ? otherValue : new ExactRational(otherValue);
		const leftProduct = this.numerator * otherRational.denominator;
		const rightProduct = otherRational.numerator * this.denominator;
		if (leftProduct < rightProduct) return -1;
		if (leftProduct > rightProduct) return 1;
		return 0;
	}

	static minimum(...rationalValues) {
		return rationalValues.reduce((currentMinimum, candidate) => (candidate.compareTo(currentMinimum) < 0 ? candidate : currentMinimum));
	}

	static maximum(...rationalValues) {
		return rationalValues.reduce((currentMaximum, candidate) => (candidate.compareTo(currentMaximum) > 0 ? candidate : currentMaximum));
	}

	squareRoot(precisionDigits = TRIGONOMETRIC_PRECISION_DIGITS) {
		if (this.numerator < 0n) {
			throw new Error('Square root of negative ExactRational is undefined.');
		}
		if (this.numerator === 0n) {
			return ExactRational.ZERO;
		}
		const exactNumeratorRoot = calculateExactIntegerSquareRoot(this.numerator);
		const exactDenominatorRoot = calculateExactIntegerSquareRoot(this.denominator);
		if (exactNumeratorRoot !== null && exactDenominatorRoot !== null) {
			return new ExactRational(exactNumeratorRoot, exactDenominatorRoot);
		}

		PrecisionDisclaimerRegistry.recordApproximationTrigger({
			constantSymbol: '√x (Irrational Square Root)',
			triggerLocation: `${PrecisionDisclaimerRegistry.currentElementContext} → ${PrecisionDisclaimerRegistry.currentOperationContext}`,
			mathematicalReason: 'Radicand is not a perfect rational square (N/D); evaluated via 128-digit Newton-Raphson root approximation.'
		});

		const scalePower = 10n ** BigInt(precisionDigits * 2);
		const scaledTarget = (this.numerator * scalePower) / this.denominator;
		const bitLength = BigInt(scaledTarget.toString(2).length);
		let approximation = 1n << ((bitLength + 1n) >> 1n);
		for (let iterationIndex = 0; iterationIndex < 60; iterationIndex++) {
			const nextApproximation = (approximation + scaledTarget / approximation) >> 1n;
			if (nextApproximation === approximation || nextApproximation === approximation - 1n || nextApproximation === approximation + 1n) {
				approximation = nextApproximation;
				break;
			}
			approximation = nextApproximation;
		}
		return new ExactRational(approximation, 10n ** BigInt(precisionDigits));
	}

	static calculateSineFromDegrees(angleDegreesValue) {
		const angleDegrees = angleDegreesValue instanceof ExactRational ? angleDegreesValue : new ExactRational(angleDegreesValue);
		const halfCircle = new ExactRational(180);
		const normalizedDegrees = angleDegrees.subtract(
			new ExactRational((angleDegrees.numerator / (angleDegrees.denominator * 360n)) * 360n)
		);
		if (normalizedDegrees.isZero() || normalizedDegrees.absolute().compareTo(halfCircle) === 0) {
			return ExactRational.ZERO;
		}
		const quarterCircle = new ExactRational(90);
		if (normalizedDegrees.compareTo(quarterCircle) === 0) return ExactRational.ONE;
		if (normalizedDegrees.compareTo(quarterCircle.negate()) === 0) return ExactRational.ONE.negate();
		if (normalizedDegrees.compareTo(new ExactRational(270)) === 0) return ExactRational.ONE.negate();
		if (normalizedDegrees.compareTo(new ExactRational(-270)) === 0) return ExactRational.ONE;

		PrecisionDisclaimerRegistry.recordApproximationTrigger({
			constantSymbol: 'π (Pi) & sin/cos Taylor Series',
			triggerLocation: `${PrecisionDisclaimerRegistry.currentElementContext} → ${PrecisionDisclaimerRegistry.currentOperationContext}`,
			mathematicalReason: `Angle (${angleDegrees.toString(8)}°) is not a multiple of 90°; radian conversion (θ × π / 180) and trigonometric Taylor series require transcendental π (128 digits).`
		});

		const radians = normalizedDegrees.multiply(ExactRational.PI).divide(halfCircle);
		return ExactRational.calculateSineTaylorSeries(radians);
	}

	static calculateCosineFromDegrees(angleDegreesValue) {
		const angleDegrees = angleDegreesValue instanceof ExactRational ? angleDegreesValue : new ExactRational(angleDegreesValue);
		return ExactRational.calculateSineFromDegrees(new ExactRational(90).subtract(angleDegrees));
	}

	static calculateSineTaylorSeries(radiansRational) {
		const scaleFactor = 10n ** BigInt(TRIGONOMETRIC_PRECISION_DIGITS);
		const scaledX = (radiansRational.numerator * scaleFactor) / radiansRational.denominator;
		const negativeXSquared = -(scaledX * scaledX) / scaleFactor;
		let currentTerm = scaledX;
		let seriesSum = scaledX;
		for (let stepIndex = 1n; stepIndex <= 50n; stepIndex++) {
			const divisor = (2n * stepIndex) * (2n * stepIndex + 1n);
			currentTerm = (currentTerm * negativeXSquared) / (scaleFactor * divisor);
			if (currentTerm === 0n) break;
			seriesSum += currentTerm;
		}
		return new ExactRational(seriesSum, scaleFactor);
	}

	toString(maximumNonTerminatingDigits = null) {
		if (this.numerator === 0n) {
			return '0';
		}
		const isNegative = this.numerator < 0n;
		const absoluteNumerator = isNegative ? -this.numerator : this.numerator;
		let remainingDenominator = this.denominator;

		if (maximumNonTerminatingDigits !== null) {
			const roundingScale = 10n ** BigInt(maximumNonTerminatingDigits);
			const roundedScaled = (absoluteNumerator * roundingScale + remainingDenominator / 2n) / remainingDenominator;
			const reducedRounded = new ExactRational(isNegative ? -roundedScaled : roundedScaled, roundingScale);
			return reducedRounded.toString(null);
		}

		let countFactorTwo = 0n;
		while (remainingDenominator % 2n === 0n) {
			remainingDenominator /= 2n;
			countFactorTwo++;
		}
		let countFactorFive = 0n;
		while (remainingDenominator % 5n === 0n) {
			remainingDenominator /= 5n;
			countFactorFive++;
		}

		if (remainingDenominator === 1n) {
			const exactDecimalPlaces = countFactorTwo > countFactorFive ? countFactorTwo : countFactorFive;
			if (exactDecimalPlaces === 0n) {
				return (isNegative ? '-' : '') + absoluteNumerator.toString();
			}
			const multiplierTwo = countFactorFive > countFactorTwo ? 2n ** (countFactorFive - countFactorTwo) : 1n;
			const multiplierFive = countFactorTwo > countFactorFive ? 5n ** (countFactorTwo - countFactorFive) : 1n;
			const scaledExactInteger = absoluteNumerator * multiplierTwo * multiplierFive;
			const placesNumber = Number(exactDecimalPlaces);
			const paddedDigits = scaledExactInteger.toString().padStart(placesNumber + 1, '0');
			const integerSlice = paddedDigits.slice(0, paddedDigits.length - placesNumber);
			const fractionalSlice = paddedDigits.slice(paddedDigits.length - placesNumber).replace(/0+$/, '');
			const signPrefix = isNegative ? '-' : '';
			return fractionalSlice.length > 0 ? `${signPrefix}${integerSlice}.${fractionalSlice}` : `${signPrefix}${integerSlice}`;
		}

		PrecisionDisclaimerRegistry.recordApproximationTrigger({
			constantSymbol: `Repeating Fraction (1/${remainingDenominator.toString()})`,
			triggerLocation: `${PrecisionDisclaimerRegistry.currentElementContext} → ${PrecisionDisclaimerRegistry.currentOperationContext}`,
			mathematicalReason: `Exact rational denominator contains prime factor(s) other than 2 and 5 (factor ${remainingDenominator.toString()}); base-10 SVG text requires periodic decimal truncation at 128 digits.`
		});

		const fallbackDigits = Number(countFactorTwo > countFactorFive ? countFactorTwo : countFactorFive) + TRIGONOMETRIC_PRECISION_DIGITS;
		const fallbackScale = 10n ** BigInt(fallbackDigits);
		const scaledQuotient = (absoluteNumerator * fallbackScale + this.denominator / 2n) / this.denominator;
		const paddedFallback = scaledQuotient.toString().padStart(fallbackDigits + 1, '0');
		const integerPart = paddedFallback.slice(0, paddedFallback.length - fallbackDigits);
		const fractionalPart = paddedFallback.slice(paddedFallback.length - fallbackDigits).replace(/0+$/, '');
		const signString = isNegative ? '-' : '';
		return fractionalPart.length > 0 ? `${signString}${integerPart}.${fractionalPart}` : `${signString}${integerPart}`;
	}
}

ExactRational.ZERO = new ExactRational(0n, 1n);
ExactRational.ONE = new ExactRational(1n, 1n);
ExactRational.TWO = new ExactRational(2n, 1n);
ExactRational.THREE = new ExactRational(3n, 1n);
ExactRational.PI = new ExactRational('3.14159265358979323846264338327950288419716939937510582097494459230781640628620899862803482534211706798214808651328230664709384460955058223172535940812848111745028410270193852110555964462294895493038196');
ExactRational.KAPPA = new ExactRational('0.55228474983079339840225163227959743809289583384599876395510645147496915623596908439522460411397856399204970432796600658450636388346798718193818229794245354326992527579779750725784550788016867419532');

export class AffineTransformationMatrix {
	constructor(
		componentA = ExactRational.ONE,
		componentB = ExactRational.ZERO,
		componentC = ExactRational.ZERO,
		componentD = ExactRational.ONE,
		componentE = ExactRational.ZERO,
		componentF = ExactRational.ZERO
	) {
		this.componentA = new ExactRational(componentA);
		this.componentB = new ExactRational(componentB);
		this.componentC = new ExactRational(componentC);
		this.componentD = new ExactRational(componentD);
		this.componentE = new ExactRational(componentE);
		this.componentF = new ExactRational(componentF);
	}

	static createIdentityMatrix() {
		return new AffineTransformationMatrix();
	}

	isIdentityMatrix() {
		return (
			this.componentA.compareTo(ExactRational.ONE) === 0 &&
			this.componentB.isZero() &&
			this.componentC.isZero() &&
			this.componentD.compareTo(ExactRational.ONE) === 0 &&
			this.componentE.isZero() &&
			this.componentF.isZero()
		);
	}

	isPureTranslationMatrix() {
		return (
			this.componentA.compareTo(ExactRational.ONE) === 0 &&
			this.componentB.isZero() &&
			this.componentC.isZero() &&
			this.componentD.compareTo(ExactRational.ONE) === 0
		);
	}

	multiplyWithMatrix(otherMatrix) {
		return new AffineTransformationMatrix(
			this.componentA.multiply(otherMatrix.componentA).add(this.componentC.multiply(otherMatrix.componentB)),
			this.componentB.multiply(otherMatrix.componentA).add(this.componentD.multiply(otherMatrix.componentB)),
			this.componentA.multiply(otherMatrix.componentC).add(this.componentC.multiply(otherMatrix.componentD)),
			this.componentB.multiply(otherMatrix.componentC).add(this.componentD.multiply(otherMatrix.componentD)),
			this.componentA.multiply(otherMatrix.componentE).add(this.componentC.multiply(otherMatrix.componentF)).add(this.componentE),
			this.componentB.multiply(otherMatrix.componentE).add(this.componentD.multiply(otherMatrix.componentF)).add(this.componentF)
		);
	}

	transformPoint(coordinateX, coordinateY) {
		const rationalX = new ExactRational(coordinateX);
		const rationalY = new ExactRational(coordinateY);
		return {
			x: this.componentA.multiply(rationalX).add(this.componentC.multiply(rationalY)).add(this.componentE),
			y: this.componentB.multiply(rationalX).add(this.componentD.multiply(rationalY)).add(this.componentF)
		};
	}

	calculateDeterminant() {
		return this.componentA.multiply(this.componentD).subtract(this.componentB.multiply(this.componentC));
	}

	toTransformAttributeString() {
		if (this.isIdentityMatrix()) {
			return '';
		}
		if (this.isPureTranslationMatrix()) {
			return `translate(${this.componentE.toString()} ${this.componentF.toString()})`;
		}
		return `matrix(${this.componentA.toString()} ${this.componentB.toString()} ${this.componentC.toString()} ${this.componentD.toString()} ${this.componentE.toString()} ${this.componentF.toString()})`;
	}

	static parseTransformAttributeString(transformAttributeString, ownerElementDescription = null) {
		let accumulatedMatrix = AffineTransformationMatrix.createIdentityMatrix();
		if (!transformAttributeString) {
			return accumulatedMatrix;
		}
		const operationRegularExpression = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]+)\)/g;
		let operationMatch;
		while ((operationMatch = operationRegularExpression.exec(transformAttributeString)) !== null) {
			const operationName = operationMatch[1];
			const rawArgumentsText = operationMatch[2].trim();
			PrecisionDisclaimerRegistry.setEvaluationContext(
				ownerElementDescription || PrecisionDisclaimerRegistry.currentElementContext,
				`transform='${operationName}(${rawArgumentsText})'`
			);

			const parameterValues = [];
			const numberRegularExpression = /-?\d*\.?\d+(?:[eE][-+]?\d+)?/g;
			let numberMatch;
			while ((numberMatch = numberRegularExpression.exec(rawArgumentsText)) !== null) {
				parameterValues.push(new ExactRational(numberMatch[0]));
			}
			let stepMatrix = AffineTransformationMatrix.createIdentityMatrix();
			if (operationName === 'matrix' && parameterValues.length === 6) {
				stepMatrix = new AffineTransformationMatrix(
					parameterValues[0], parameterValues[1], parameterValues[2],
					parameterValues[3], parameterValues[4], parameterValues[5]
				);
			} else if (operationName === 'translate' && parameterValues.length >= 1) {
				stepMatrix = new AffineTransformationMatrix(
					ExactRational.ONE, ExactRational.ZERO, ExactRational.ZERO, ExactRational.ONE,
					parameterValues[0], parameterValues[1] || ExactRational.ZERO
				);
			} else if (operationName === 'scale' && parameterValues.length >= 1) {
				stepMatrix = new AffineTransformationMatrix(
					parameterValues[0], ExactRational.ZERO, ExactRational.ZERO,
					parameterValues.length > 1 ? parameterValues[1] : parameterValues[0],
					ExactRational.ZERO, ExactRational.ZERO
				);
			} else if (operationName === 'rotate' && parameterValues.length >= 1) {
				const cosineValue = ExactRational.calculateCosineFromDegrees(parameterValues[0]);
				const sineValue = ExactRational.calculateSineFromDegrees(parameterValues[0]);
				const rotationMatrix = new AffineTransformationMatrix(
					cosineValue, sineValue, sineValue.negate(), cosineValue,
					ExactRational.ZERO, ExactRational.ZERO
				);
				if (parameterValues.length >= 3 && (!parameterValues[1].isZero() || !parameterValues[2].isZero())) {
					const shiftPositive = new AffineTransformationMatrix(
						ExactRational.ONE, ExactRational.ZERO, ExactRational.ZERO, ExactRational.ONE,
						parameterValues[1], parameterValues[2]
					);
					const shiftNegative = new AffineTransformationMatrix(
						ExactRational.ONE, ExactRational.ZERO, ExactRational.ZERO, ExactRational.ONE,
						parameterValues[1].negate(), parameterValues[2].negate()
					);
					stepMatrix = shiftPositive.multiplyWithMatrix(rotationMatrix).multiplyWithMatrix(shiftNegative);
				} else {
					stepMatrix = rotationMatrix;
				}
			} else if (operationName === 'skewX' && parameterValues.length >= 1) {
				const tangentValue = ExactRational.calculateSineFromDegrees(parameterValues[0]).divide(
					ExactRational.calculateCosineFromDegrees(parameterValues[0])
				);
				stepMatrix = new AffineTransformationMatrix(
					ExactRational.ONE, ExactRational.ZERO, tangentValue,
					ExactRational.ONE, ExactRational.ZERO, ExactRational.ZERO
				);
			} else if (operationName === 'skewY' && parameterValues.length >= 1) {
				const tangentValue = ExactRational.calculateSineFromDegrees(parameterValues[0]).divide(
					ExactRational.calculateCosineFromDegrees(parameterValues[0])
				);
				stepMatrix = new AffineTransformationMatrix(
					ExactRational.ONE, tangentValue, ExactRational.ZERO,
					ExactRational.ONE, ExactRational.ZERO, ExactRational.ZERO
				);
			}
			accumulatedMatrix = accumulatedMatrix.multiplyWithMatrix(stepMatrix);
		}
		return accumulatedMatrix;
	}
}