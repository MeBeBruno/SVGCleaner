import { cleanToolDefinition } from './tool-clean.js';
import { pathModeToolDefinition } from './tool-path-mode.js';
import { flattenTransformsToolDefinition } from './tool-flatten-transforms.js';
import { groupCoordinatesToolDefinition } from './tool-group-coordinates.js';
import { originAnchorToolDefinition } from './tool-origin-anchor.js';
import { matrixFlipToolDefinition } from './tool-matrix-flip.js';
import { reframeViewBoxToolDefinition } from './tool-reframe-viewbox.js';

export const MODULAR_TOOLS_REGISTRY = new Map([
	[cleanToolDefinition.identifier, cleanToolDefinition],
	[pathModeToolDefinition.identifier, pathModeToolDefinition],
	[flattenTransformsToolDefinition.identifier, flattenTransformsToolDefinition],
	[groupCoordinatesToolDefinition.identifier, groupCoordinatesToolDefinition],
	[originAnchorToolDefinition.identifier, originAnchorToolDefinition],
	[matrixFlipToolDefinition.identifier, matrixFlipToolDefinition],
	[reframeViewBoxToolDefinition.identifier, reframeViewBoxToolDefinition]
]);

export function createDefaultPipelineSteps() {
	return [
		{
			stepIdentifier: 'step-1',
			toolIdentifier: 'flatten',
			enabled: true,
			options: { ...flattenTransformsToolDefinition.defaultOptions }
		},
		{
			stepIdentifier: 'step-2',
			toolIdentifier: 'reframe',
			enabled: true,
			options: { ...reframeViewBoxToolDefinition.defaultOptions }
		},
		{
			stepIdentifier: 'step-3',
			toolIdentifier: 'origin',
			enabled: true,
			options: { anchor: 'top_left' }
		}
	];
}

export const pipelineToolDefinition = {
	identifier: 'pipeline',
	label: 'Pipeline',
	iconName: 'workflow',
	tooltip: 'Chain multiple tools modularly in a single exact rational pass without intermediate rounding',
	executePipelineStepsOnDom(svgRootElement, parsedDocument, pipelineStepsList) {
		for (const stepConfiguration of pipelineStepsList) {
			if (!stepConfiguration.enabled) continue;
			const targetTool = MODULAR_TOOLS_REGISTRY.get(stepConfiguration.toolIdentifier);
			if (targetTool) {
				targetTool.executeOnDom(svgRootElement, parsedDocument, stepConfiguration.options);
			}
		}
	}
};