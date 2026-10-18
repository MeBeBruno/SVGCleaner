import { PrecisionDisclaimerRegistry } from './exact-mathematics.js';
import { PathGeometryEngine, parseSvgDocumentStrict } from './path-geometry.js';
import { cleanToolDefinition } from './tool-clean.js';
import { pathModeToolDefinition } from './tool-path-mode.js';
import { flattenTransformsToolDefinition } from './tool-flatten-transforms.js';
import { groupCoordinatesToolDefinition } from './tool-group-coordinates.js';
import { originAnchorToolDefinition } from './tool-origin-anchor.js';
import { matrixFlipToolDefinition } from './tool-matrix-flip.js';
import { reframeViewBoxToolDefinition } from './tool-reframe-viewbox.js';
import { pipelineToolDefinition, MODULAR_TOOLS_REGISTRY, createDefaultPipelineSteps } from './tool-pipeline.js';
import { FormatAndDiffEngine, LocalHistoryStorage } from './diff-and-history.js';

const LUCIDE_ICON_PATHS = {
	'sparkles': '<path d=\'M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z\'/><path d=\'M20 3v4\'/><path d=\'M22 5h-4\'/>',
	'route': '<circle cx=\'6\' cy=\'19\' r=\'3\'/><path d=\'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15\'/><circle cx=\'18\' cy=\'5\' r=\'3\'/>',
	'layers': '<path d=\'m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z\'/><path d=\'m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65\'/><path d=\'m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65\'/>',
	'boxes': '<path d=\'M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z\'/><path d=\'m7 16.5-4.74-2.85\'/><path d=\'m7 16.5 5-3\'/><path d=\'M7 16.5v5.17\'/><path d=\'M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z\'/><path d=\'m17 16.5-5-3\'/><path d=\'m17 16.5 4.74-2.85\'/><path d=\'M17 16.5v5.17\'/><path d=\'M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z\'/><path d=\'M12 8 7.26 5.15\'/><path d=\'m12 8 4.74-2.85\'/><path d=\'M12 13.5V8\'/>',
	'crosshair': '<circle cx=\'12\' cy=\'12\' r=\'10\'/><line x1=\'22\' x2=\'18\' y1=\'12\' y2=\'12\'/><line x1=\'6\' x2=\'2\' y1=\'12\' y2=\'12\'/><line x1=\'12\' x2=\'12\' y1=\'6\' y2=\'2\'/><line x1=\'12\' x2=\'12\' y1=\'22\' y2=\'18\'/>',
	'flip-horizontal': '<path d=\'M8 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h3\'/><path d=\'M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3\'/><path d=\'M12 20v2\'/><path d=\'M12 14v2\'/><path d=\'M12 8v2\'/><path d=\'M12 2v2\'/>',
	'crop': '<path d=\'M6 2v14a2 2 0 0 0 2 2h14\'/><path d=\'M18 22V8a2 2 0 0 0-2-2H2\'/>',
	'workflow': '<rect width=\'8\' height=\'8\' x=\'3\' y=\'3\' rx=\'2\'/><path d=\'M7 11v4a2 2 0 0 0 2 2h4\'/><rect width=\'8\' height=\'8\' x=\'13\' y=\'13\' rx=\'2\'/>',
	'shield-check': '<path d=\'M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z\'/><path d=\'m9 12 2 2 4-4\'/>',
	'alert-triangle': '<path d=\'m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\'/><path d=\'M12 9v4\'/><path d=\'M12 17h.01\'/>',
	'history': '<path d=\'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\'/><path d=\'M3 3v5h5\'/><path d=\'M12 7v5l4 2\'/>',
	'file-input': '<path d=\'M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4\'/><path d=\'M14 2v4a2 2 0 0 0 2 2h4\'/><path d=\'M2 15h10\'/><path d=\'m9 18 3-3-3-3\'/>',
	'file-code': '<path d=\'M10 12.5 8 15l2 2.5\'/><path d=\'m14 12.5 2 2.5-2 2.5\'/><path d=\'M14 2v4a2 2 0 0 0 2 2h4\'/><path d=\'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z\'/>',
	'eye': '<path d=\'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0\'/><circle cx=\'12\' cy=\'12\' r=\'3\'/>',
	'info': '<circle cx=\'12\' cy=\'12\' r=\'10\'/><path d=\'M12 16v-4\'/><path d=\'M12 8h.01\'/>',
	'folder-open': '<path d=\'m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\'/>',
	'trash-2': '<path d=\'M3 6h18\'/><path d=\'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\'/><path d=\'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\'/><line x1=\'10\' x2=\'10\' y1=\'11\' y2=\'17\'/><line x1=\'14\' x2=\'14\' y1=\'11\' y2=\'17\'/>',
	'upload': '<path d=\'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\'/><polyline points=\'17 8 12 3 7 8\'/><line x1=\'12\' x2=\'12\' y1=\'3\' y2=\'15\'/>',
	'git-compare': '<circle cx=\'18\' cy=\'18\' r=\'3\'/><circle cx=\'6\' cy=\'6\' r=\'3\'/><path d=\'M13 6h3a2 2 0 0 1 2 2v7\'/><path d=\'M11 18H8a2 2 0 0 1-2-2V9\'/>',
	'copy': '<rect width=\'14\' height=\'14\' x=\'8\' y=\'8\' rx=\'2\' ry=\'2\'/><path d=\'M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\'/>',
	'download': '<path d=\'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\'/><polyline points=\'7 10 12 15 17 10\'/><line x1=\'12\' x2=\'12\' y1=\'15\' y2=\'3\'/>',
	'x': '<path d=\'M18 6 6 18\'/><path d=\'m6 6 12 12\'/>',
	'plus': '<path d=\'M5 12h14\'/><path d=\'M12 5v14\'/>',
	'arrow-up': '<path d=\'m5 12 7-7 7 7\'/><path d=\'M12 19V5\'/>',
	'arrow-down': '<path d=\'M12 5v14\'/><path d=\'m19 12-7 7-7-7\'/>',
	'check': '<path d=\'M20 6 9 17l-5-5\'/>'
};

function renderSvgIconMarkup(iconName) {
	const pathContent = LUCIDE_ICON_PATHS[iconName] || LUCIDE_ICON_PATHS['info'];
	return `<svg class='icon-svg' viewBox='0 0 24 24' aria-hidden='true'>${pathContent}</svg>`;
}

function hydrateAllIconsInContainer(rootContainer = document) {
	for (const iconPlaceholder of Array.from(rootContainer.querySelectorAll('[data-icon]'))) {
		const iconName = iconPlaceholder.getAttribute('data-icon');
		iconPlaceholder.innerHTML = renderSvgIconMarkup(iconName);
	}
}

const ORDERED_SUITE_TOOLS = [
	cleanToolDefinition,
	pathModeToolDefinition,
	flattenTransformsToolDefinition,
	groupCoordinatesToolDefinition,
	originAnchorToolDefinition,
	matrixFlipToolDefinition,
	reframeViewBoxToolDefinition,
	pipelineToolDefinition
];

class ApplicationStateController {
	constructor() {
		this.activeToolIdentifier = 'clean';
		this.currentFileName = 'vector.svg';
		this.showDiffView = true;
		this.showOriginAxes = true;
		this.showDisclaimerDetails = true;
		this.previewMode = 'split';
		this.lastInputSvg = '';
		this.lastOutputSvg = '';
		this.toolOptionStates = {};
		for (const tool of ORDERED_SUITE_TOOLS) {
			if (tool.defaultOptions) {
				this.toolOptionStates[tool.identifier] = { ...tool.defaultOptions };
			}
		}
		this.pipelineSteps = createDefaultPipelineSteps();
		this.nextPipelineStepCounter = 4;

		this.initializeUserInterface();
	}

	initializeUserInterface() {
		hydrateAllIconsInContainer(document);
		this.renderTabNavigation();
		this.renderToolConfigurationStrip();
		this.bindGlobalEventListeners();
		this.updateHistoryBadgeCount();
		this.loadInitialDemonstrationSvg();
	}

	renderTabNavigation() {
		const navigationContainer = document.getElementById('tabNavigation');
		navigationContainer.innerHTML = ORDERED_SUITE_TOOLS.map((tool) => {
			const isSelected = tool.identifier === this.activeToolIdentifier;
			return `
				<button type='button' role='tab' class='tab-button' data-tool-tab='${tool.identifier}' aria-selected='${isSelected}' title='${tool.tooltip}'>
					${renderSvgIconMarkup(tool.iconName)}
					<span>${tool.label}</span>
				</button>
			`;
		}).join('');

		for (const tabButton of Array.from(navigationContainer.querySelectorAll('[data-tool-tab]'))) {
			tabButton.addEventListener('click', () => {
				this.activeToolIdentifier = tabButton.getAttribute('data-tool-tab');
				this.renderTabNavigation();
				this.renderToolConfigurationStrip();
				this.processCurrentSvgInput(true);
			});
		}
	}

	renderToolConfigurationStrip() {
		const stripContainer = document.getElementById('toolConfigurationStrip');
		const activeId = this.activeToolIdentifier;
		const options = this.toolOptionStates[activeId] || {};

		if (activeId === 'clean') {
			const cleanCheckboxes = [
				['removeComments', 'Comments', 'Remove XML comments'],
				['removeMetadata', 'Metadata', 'Remove <metadata>, <title>, and <desc> elements'],
				['removeEmptyElements', 'Empty Nodes', 'Remove empty container elements'],
				['cleanAttributes', 'Default Attrs', 'Strip redundant default and editor attributes'],
				['removeDimensions', 'Strip W/H', 'Remove root width and height while preserving viewBox'],
				['cleanNamespaces', 'Namespaces', 'Remove unused editor XML namespaces'],
				['normalizeIds', 'ASCII IDs', 'Replace non-ASCII IDs and update references'],
				['flattenEmptyGroups', 'Empty Groups', 'Unwrap attribute-less <g> tags and remove hidden elements'],
				['normalizePathWhitespace', 'Normalize d', 'Normalize whitespace in path data without altering coordinates']
			];
			stripContainer.innerHTML = `<div class='option-group'>${cleanCheckboxes.map(([key, label, tooltipText]) => `
				<label class='toggle-chip' title='${tooltipText}'>
					<input type='checkbox' data-option-key='${key}'${options[key] ? 'checked' : ''}>
					<span>${label}</span>
				</label>
			`).join('')}</div>`;
		} else if (activeId === 'path') {
			stripContainer.innerHTML = `
				<div class='option-group'>
					<label class='inline-field'>
						<span>Mode</span>
						<select class='inline-select' data-option-key='direction'>
							<option value='toRelative' ${options.direction === 'toRelative' ? 'selected' : ''}>Absolute → Relative (m, l, c)</option>
							<option value='toAbsolute' ${options.direction === 'toAbsolute' ? 'selected' : ''}>Relative → Absolute (M, L, C)</option>
						</select>
					</label>
					<label class='toggle-chip' title='Convert rect, circle, ellipse, line, polygon to path (uses exact A-arcs for circles)'>
						<input type='checkbox' data-option-key='convertShapes' ${options.convertShapes ? 'checked' : ''}>
						<span>Shapes → Path</span>
					</label>
				</div>
			`;
		} else if (activeId === 'flatten') {
			stripContainer.innerHTML = `
				<div class='option-group'>
					<label class='toggle-chip' title='Keep native shapes (<circle>, <rect>, etc.) when off, or convert to <path> when on'>
						<input type='checkbox' data-option-key='convertShapes' ${options.convertShapes ? 'checked' : ''}>
						<span>Shapes → Path</span>
					</label>
					<label class='toggle-chip' title='Output relative path commands after baking transforms'>
						<input type='checkbox' data-option-key='outputRelative' ${options.outputRelative ? 'checked' : ''}>
						<span>Relative Output</span>
					</label>
					<label class='toggle-chip' title='Remove group tags once their transform attribute is baked'>
						<input type='checkbox' data-option-key='unwrapTransformedGroups' ${options.unwrapTransformedGroups ? 'checked' : ''}>
						<span>Unwrap Groups</span>
					</label>
				</div>
			`;
		} else if (activeId === 'groups') {
			stripContainer.innerHTML = `
				<div class='option-group'>
					<label class='toggle-chip' title='Keep native shapes (<circle>, <rect>, etc.) when off, or convert to <path> when on'>
						<input type='checkbox' data-option-key='convertShapes' ${options.convertShapes ? 'checked' : ''}>
						<span>Shapes → Path</span>
					</label>
				</div>
			`;
		} else if (activeId === 'origin') {
			const anchorOptions = [
				['top_left', 'Top Left'],
				['top_center_horizontal', 'Top Center'],
				['top_right', 'Top Right'],
				['center_vertical_left', 'Middle Left'],
				['center_vertical_center_horizontal', 'Center (0|0)'],
				['center_vertical_right', 'Middle Right'],
				['bottom_left', 'Bottom Left'],
				['bottom_center_horizontal', 'Bottom Center'],
				['bottom_right', 'Bottom Right']
			];
			stripContainer.innerHTML = `
				<div class='option-group'>
					<label class='inline-field'>
						<span>Anchor (0|0)</span>
						<select class='inline-select' data-option-key='anchor'>
							${anchorOptions.map(([value, text]) => `<option value='${value}' ${options.anchor === value ? 'selected' : ''}>${text}</option>`).join('')}
						</select>
					</label>
				</div>
			`;
		} else if (activeId === 'matrix') {
			const isCustom = options.mode === 'customMatrix';
			stripContainer.innerHTML = `
				<div class='option-group'>
					<label class='inline-field'>
						<span>Operation</span>
						<select class='inline-select' data-option-key='mode'>
							<option value='flipHorizontalCenter' ${options.mode === 'flipHorizontalCenter' ? 'selected' : ''}>Flip Horizontal (Center)</option>
							<option value='flipVerticalCenter' ${options.mode === 'flipVerticalCenter' ? 'selected' : ''}>Flip Vertical (Center)</option>
							<option value='flipHorizontalOrigin' ${options.mode === 'flipHorizontalOrigin' ? 'selected' : ''}>Flip Horizontal (0|0)</option>
							<option value='flipVerticalOrigin' ${options.mode === 'flipVerticalOrigin' ? 'selected' : ''}>Flip Vertical (0|0)</option>
							<option value='customMatrix' ${isCustom ? 'selected' : ''}>Custom Matrix [a b c d e f]</option>
						</select>
					</label>
					<label class='toggle-chip' title='Keep native shapes (<circle>, <rect>, etc.) when off, or convert to <path> when on'>
						<input type='checkbox' data-option-key='convertShapes' ${options.convertShapes ? 'checked' : ''}>
						<span>Shapes → Path</span>
					</label>
					${isCustom ? ['A', 'B', 'C', 'D', 'E', 'F'].map((letter) => `
						<label class='inline-field'>
							<span>${letter.toLowerCase()}</span>
							<input type='text' class='inline-input' data-option-key='matrix${letter}' value='${options['matrix' + letter]}'>
						</label>
					`).join('') : ''}
				</div>
			`;
		} else if (activeId === 'reframe') {
			stripContainer.innerHTML = `
				<div class='option-group'>
					<label class='inline-field' title='Exact rational margin added around the analytical bounding box'>
						<span>Padding</span>
						<input type='text' class='inline-input' data-option-key='padding' value='${options.padding}'>
					</label>
					<label class='toggle-chip' title='Remove static width and height attributes'>
						<input type='checkbox' data-option-key='removeDimensions' ${options.removeDimensions ? 'checked' : ''}>
						<span>Strip W/H</span>
					</label>
				</div>
			`;
		} else if (activeId === 'pipeline') {
			this.renderPipelineBuilderStrip(stripContainer);
			return;
		}

		for (const inputControl of Array.from(stripContainer.querySelectorAll('[data-option-key]'))) {
			const eventType = inputControl.type === 'text' ? 'input' : 'change';
			inputControl.addEventListener(eventType, () => {
				const key = inputControl.getAttribute('data-option-key');
				this.toolOptionStates[activeId][key] = inputControl.type === 'checkbox' ? inputControl.checked : inputControl.value;
				if (key === 'mode') {
					this.renderToolConfigurationStrip();
				}
				this.processCurrentSvgInput(eventType === 'change');
			});
		}
	}

	renderPipelineBuilderStrip(stripContainer) {
		const availableTools = Array.from(MODULAR_TOOLS_REGISTRY.values());
		const stepsMarkup = this.pipelineSteps.map((step, index) => {
			const tool = MODULAR_TOOLS_REGISTRY.get(step.toolIdentifier);
			let inlineParamMarkup = '';
			if (step.toolIdentifier === 'path') {
				inlineParamMarkup = `
					<select class='inline-select' data-step-param='${step.stepIdentifier}:direction'>
						<option value='toRelative' ${step.options.direction === 'toRelative' ? 'selected' : ''}>Rel</option>
						<option value='toAbsolute' ${step.options.direction === 'toAbsolute' ? 'selected' : ''}>Abs</option>
					</select>
				`;
			} else if (step.toolIdentifier === 'origin') {
				inlineParamMarkup = `
					<select class='inline-select' data-step-param='${step.stepIdentifier}:anchor'>
						<option value='top_left' ${step.options.anchor === 'top_left' ? 'selected' : ''}>TL</option>
						<option value='center_vertical_center_horizontal' ${step.options.anchor === 'center_vertical_center_horizontal' ? 'selected' : ''}>Center</option>
						<option value='bottom_right' ${step.options.anchor === 'bottom_right' ? 'selected' : ''}>BR</option>
					</select>
				`;
			} else if (step.toolIdentifier === 'matrix') {
				inlineParamMarkup = `
					<select class='inline-select' data-step-param='${step.stepIdentifier}:mode'>
						<option value='flipHorizontalCenter' ${step.options.mode === 'flipHorizontalCenter' ? 'selected' : ''}>Flip H</option>
						<option value='flipVerticalCenter' ${step.options.mode === 'flipVerticalCenter' ? 'selected' : ''}>Flip V</option>
					</select>
				`;
			}
			return `
				<div class='pipeline-step-pill ${step.enabled ? '' : 'disabled-step'}'>
					<button type='button' class='step-mini-button' data-step-toggle='${step.stepIdentifier}' title='Toggle Step'>
						${renderSvgIconMarkup('check')}
					</button>
					<span>${index + 1}. ${tool ? tool.label : step.toolIdentifier}</span>
					${inlineParamMarkup}
					<button type='button' class='step-mini-button' data-step-up='${index}' title='Move Left'>${renderSvgIconMarkup('arrow-up')}</button>
					<button type='button' class='step-mini-button' data-step-down='${index}' title='Move Right'>${renderSvgIconMarkup('arrow-down')}</button>
					<button type='button' class='step-mini-button' data-step-remove='${step.stepIdentifier}' title='Remove Step'>${renderSvgIconMarkup('x')}</button>
				</div>
			`;
		}).join('');

		stripContainer.innerHTML = `
			<div class='pipeline-builder'>
				${stepsMarkup}
				<div class='inline-field'>
					<select class='inline-select' id='addPipelineToolSelect' aria-label='Add Tool Step'>
						${availableTools.map((tool) => `<option value='${tool.identifier}'>+${tool.label}</option>`).join('')}
					</select>
					<button type='button' class='action-button' id='appendPipelineStepButton' title='Append Step to Pipeline'>
						${renderSvgIconMarkup('plus')}
						<span>Add</span>
					</button>
				</div>
			</div>
		`;

		document.getElementById('appendPipelineStepButton').addEventListener('click', () => {
			const selectedToolId = document.getElementById('addPipelineToolSelect').value;
			const toolDefinition = MODULAR_TOOLS_REGISTRY.get(selectedToolId);
			if (toolDefinition) {
				this.pipelineSteps.push({
					stepIdentifier: `step-${this.nextPipelineStepCounter++}`,
					toolIdentifier: selectedToolId,
					enabled: true,
					options: { ...toolDefinition.defaultOptions }
				});
				this.renderToolConfigurationStrip();
				this.processCurrentSvgInput(true);
			}
		});

		for (const toggleButton of Array.from(stripContainer.querySelectorAll('[data-step-toggle]'))) {
			toggleButton.addEventListener('click', () => {
				const stepId = toggleButton.getAttribute('data-step-toggle');
				const targetStep = this.pipelineSteps.find((item) => item.stepIdentifier === stepId);
				if (targetStep) {
					targetStep.enabled = !targetStep.enabled;
					this.renderToolConfigurationStrip();
					this.processCurrentSvgInput(true);
				}
			});
		}

		for (const removeButton of Array.from(stripContainer.querySelectorAll('[data-step-remove]'))) {
			removeButton.addEventListener('click', () => {
				const stepId = removeButton.getAttribute('data-step-remove');
				this.pipelineSteps = this.pipelineSteps.filter((item) => item.stepIdentifier !== stepId);
				this.renderToolConfigurationStrip();
				this.processCurrentSvgInput(true);
			});
		}

		for (const moveUpButton of Array.from(stripContainer.querySelectorAll('[data-step-up]'))) {
			moveUpButton.addEventListener('click', () => {
				const index = Number(moveUpButton.getAttribute('data-step-up'));
				if (index > 0) {
					const temporary = this.pipelineSteps[index - 1];
					this.pipelineSteps[index - 1] = this.pipelineSteps[index];
					this.pipelineSteps[index] = temporary;
					this.renderToolConfigurationStrip();
					this.processCurrentSvgInput(true);
				}
			});
		}

		for (const moveDownButton of Array.from(stripContainer.querySelectorAll('[data-step-down]'))) {
			moveDownButton.addEventListener('click', () => {
				const index = Number(moveDownButton.getAttribute('data-step-down'));
				if (index < this.pipelineSteps.length - 1) {
					const temporary = this.pipelineSteps[index + 1];
					this.pipelineSteps[index + 1] = this.pipelineSteps[index];
					this.pipelineSteps[index] = temporary;
					this.renderToolConfigurationStrip();
					this.processCurrentSvgInput(true);
				}
			});
		}

		for (const paramSelect of Array.from(stripContainer.querySelectorAll('[data-step-param]'))) {
			paramSelect.addEventListener('change', () => {
				const [stepId, optionKey] = paramSelect.getAttribute('data-step-param').split(':');
				const targetStep = this.pipelineSteps.find((item) => item.stepIdentifier === stepId);
				if (targetStep) {
					targetStep.options[optionKey] = paramSelect.value;
					this.processCurrentSvgInput(true);
				}
			});
		}
	}

	bindGlobalEventListeners() {
		const inputTextArea = document.getElementById('svgInputTextArea');
		const dropWrapper = document.getElementById('inputDropWrapper');
		const hiddenFileInput = document.getElementById('hiddenFileInput');

		inputTextArea.addEventListener('input', () => this.processCurrentSvgInput(false));
		inputTextArea.addEventListener('blur', () => this.processCurrentSvgInput(true));

		document.getElementById('uploadTriggerButton').addEventListener('click', () => hiddenFileInput.click());
		hiddenFileInput.addEventListener('change', (event) => {
			if (event.target.files.length > 0) {
				this.readUploadedSvgFile(event.target.files[0]);
			}
		});

		window.addEventListener('dragover', (event) => {
			event.preventDefault();
			dropWrapper.classList.add('drag-active');
		});
		window.addEventListener('dragleave', (event) => {
			if (event.relatedTarget === null) {
				dropWrapper.classList.remove('drag-active');
			}
		});
		window.addEventListener('drop', (event) => {
			event.preventDefault();
			dropWrapper.classList.remove('drag-active');
			if (event.dataTransfer.files.length > 0) {
				this.readUploadedSvgFile(event.dataTransfer.files[0]);
			}
		});

		document.getElementById('clearInputButton').addEventListener('click', () => {
			inputTextArea.value = '';
			this.lastInputSvg = '';
			this.lastOutputSvg = '';
			this.clearOutputWorkspace();
		});

		const toggleDiffButton = document.getElementById('toggleDiffButton');
		toggleDiffButton.addEventListener('click', () => {
			this.showDiffView = !this.showDiffView;
			toggleDiffButton.classList.toggle('active', this.showDiffView);
			this.renderCodeOutputPane();
		});

		document.getElementById('toggleDisclaimerDetailsButton').addEventListener('click', () => {
			this.showDisclaimerDetails = !this.showDisclaimerDetails;
			document.getElementById('disclaimerTriggersList').hidden = !this.showDisclaimerDetails;
			document.getElementById('toggleDisclaimerLabel').textContent = this.showDisclaimerDetails ? 'Hide' : 'Details';
		});

		document.getElementById('copyOutputButton').addEventListener('click', () => {
			if (!this.lastOutputSvg) return;
			navigator.clipboard.writeText(this.lastOutputSvg).then(() => {
				const labelSpan = document.getElementById('copyButtonLabel');
				labelSpan.textContent = 'Copied';
				setTimeout(() => {
					labelSpan.textContent = 'Copy';
				}, 1400);
			});
		});

		document.getElementById('downloadOutputButton').addEventListener('click', () => {
			if (!this.lastOutputSvg) return;
			this.downloadSvgFile(this.lastOutputSvg, this.currentFileName);
		});

		for (const segmentButton of Array.from(document.querySelectorAll('[data-preview-mode]'))) {
			segmentButton.addEventListener('click', () => {
				for (const button of Array.from(document.querySelectorAll('[data-preview-mode]'))) {
					button.classList.remove('active');
				}
				segmentButton.classList.add('active');
				this.previewMode = segmentButton.getAttribute('data-preview-mode');
				document.getElementById('previewStage').setAttribute('data-mode', this.previewMode);
				this.renderVisualPreviewPane();
			});
		}

		const toggleAxesButton = document.getElementById('toggleAxesButton');
		toggleAxesButton.addEventListener('click', () => {
			this.showOriginAxes = !this.showOriginAxes;
			toggleAxesButton.classList.toggle('active', this.showOriginAxes);
			this.renderVisualPreviewPane();
		});

		const historyDrawer = document.getElementById('historyDrawer');
		document.getElementById('historyToggleButton').addEventListener('click', () => {
			this.renderHistoryList();
			historyDrawer.setAttribute('aria-hidden', 'false');
		});
		document.getElementById('closeHistoryButton').addEventListener('click', () => {
			historyDrawer.setAttribute('aria-hidden', 'true');
		});
		document.getElementById('clearHistoryButton').addEventListener('click', () => {
			LocalHistoryStorage.clearAllEntries();
			this.renderHistoryList();
			this.updateHistoryBadgeCount();
		});
	}

	readUploadedSvgFile(fileObject) {
		this.currentFileName = fileObject.name || 'vector.svg';
		const fileReader = new FileReader();
		fileReader.onload = (loadEvent) => {
			document.getElementById('svgInputTextArea').value = loadEvent.target.result;
			this.processCurrentSvgInput(true);
		};
		fileReader.readAsText(fileObject);
	}

	processCurrentSvgInput(recordInHistory = false) {
		const rawInputString = document.getElementById('svgInputTextArea').value;
		if (!rawInputString.trim()) {
			this.clearOutputWorkspace();
			return;
		}
		try {
			this.hideErrorBanner();
			PrecisionDisclaimerRegistry.resetRegistry();

			let finalOutputString = null;
			const activeId = this.activeToolIdentifier;

			if (activeId === 'path') {
				finalOutputString = pathModeToolDefinition.executeDirectStringPatch(
					rawInputString,
					this.toolOptionStates.path
				);
			}

			if (finalOutputString === null) {
				const { parsedDocument, svgRootElement } = parseSvgDocumentStrict(rawInputString);
				if (activeId === 'pipeline') {
					pipelineToolDefinition.executePipelineStepsOnDom(
						svgRootElement,
						parsedDocument,
						this.pipelineSteps
					);
				} else {
					const activeTool = MODULAR_TOOLS_REGISTRY.get(activeId);
					if (activeTool) {
						activeTool.executeOnDom(
							svgRootElement,
							parsedDocument,
							this.toolOptionStates[activeId] || {}
						);
					}
				}
				finalOutputString = FormatAndDiffEngine.serializeDomPreservingIndentation(
					rawInputString,
					svgRootElement
				);
			}

			const processingDisclaimerTriggers = PrecisionDisclaimerRegistry.retrieveRecordedTriggers();

			this.lastInputSvg = rawInputString;
			this.lastOutputSvg = finalOutputString;

			this.renderPrecisionDisclaimerState(processingDisclaimerTriggers);
			this.renderCodeOutputPane();
			this.renderVisualPreviewPane();
			this.updateMetricsBar(rawInputString, finalOutputString);

			document.getElementById('copyOutputButton').disabled = false;
			document.getElementById('downloadOutputButton').disabled = false;

			if (recordInHistory) {
				LocalHistoryStorage.recordEntry({
					toolIdentifier: activeId,
					fileName: this.currentFileName,
					inputSvg: rawInputString,
					outputSvg: finalOutputString
				});
				this.updateHistoryBadgeCount();
			}
		} catch (processingError) {
			this.showErrorBanner(processingError.message);
		}
	}

	renderPrecisionDisclaimerState(recordedTriggersList) {
		const badgeElement = document.getElementById('precisionStatusBadge');
		const badgeIconElement = document.getElementById('precisionStatusIcon');
		const badgeTextElement = document.getElementById('precisionStatusText');
		const disclaimerBanner = document.getElementById('precisionDisclaimerBanner');
		const disclaimerSummaryText = document.getElementById('disclaimerSummaryText');
		const disclaimerTriggersList = document.getElementById('disclaimerTriggersList');
		const toggleDisclaimerLabel = document.getElementById('toggleDisclaimerLabel');

		if (recordedTriggersList.length === 0) {
			badgeElement.classList.remove('approximation-active');
			badgeElement.title = '100% Exact Rational (Q) — No Pi, irrational roots, or repeating decimal approximations used';
			badgeIconElement.innerHTML = renderSvgIconMarkup('shield-check');
			badgeTextElement.textContent = 'Exact Q';
			disclaimerBanner.hidden = true;
			disclaimerTriggersList.innerHTML = '';
			return;
		}

		badgeElement.classList.add('approximation-active');
		badgeElement.title = `Approximation Notice: ${recordedTriggersList.length} operation(s) required Pi, irrational square roots, or periodic decimal truncation (128 digits)`;
		badgeIconElement.innerHTML = renderSvgIconMarkup('alert-triangle');
		badgeTextElement.textContent = `Approx (${recordedTriggersList.length})`;

		disclaimerSummaryText.textContent = `Precision Disclaimer: ${recordedTriggersList.length} calculation(s) required irrational/transcendental values (π, √x, or periodic 1/p) approximated to 128 digits:`;
		disclaimerTriggersList.innerHTML = recordedTriggersList.map((trigger) => `
			<div class='disclaimer-trigger-item'>
				<span class='disclaimer-trigger-source'>${FormatAndDiffEngine.escapeHtmlEntities(trigger.triggerLocation)}</span>
				<span class='disclaimer-trigger-constant'>${FormatAndDiffEngine.escapeHtmlEntities(trigger.constantSymbol)}</span>
				<span class='disclaimer-trigger-reason'>${FormatAndDiffEngine.escapeHtmlEntities(trigger.mathematicalReason)}</span>
			</div>
		`).join('');

		disclaimerBanner.hidden = false;
		disclaimerTriggersList.hidden = !this.showDisclaimerDetails;
		toggleDisclaimerLabel.textContent = this.showDisclaimerDetails ? 'Hide' : 'Details';
	}

	renderCodeOutputPane() {
		const outputViewer = document.getElementById('codeOutputViewer');
		if (!this.lastOutputSvg) {
			outputViewer.innerHTML = '';
			return;
		}
		outputViewer.innerHTML = this.showDiffView
			? FormatAndDiffEngine.generateDiffMarkup(this.lastInputSvg, this.lastOutputSvg)
			: FormatAndDiffEngine.generatePlainCodeMarkup(this.lastOutputSvg);
	}

	renderVisualPreviewPane() {
		const beforeMount = document.getElementById('beforeSvgMount');
		const afterMount = document.getElementById('afterSvgMount');
		const afterSlotTag = document.getElementById('afterSlotTag');
		const viewBoxMetricsLabel = document.getElementById('viewBoxMetricsLabel');

		beforeMount.innerHTML = '';
		afterMount.innerHTML = '';
		if (!this.lastOutputSvg) return;

		const prepareFittedSvgElement = (rawSvgString) => {
			const { svgRootElement } = parseSvgDocumentStrict(rawSvgString);
			let viewBoxString = svgRootElement.getAttribute('viewBox');
			if (!viewBoxString) {
				const analyticalBounds = PathGeometryEngine.calculateExactAnalyticalBoundingBox(svgRootElement, false);
				if (analyticalBounds) {
					viewBoxString = `${analyticalBounds.x.toString(8)} ${analyticalBounds.y.toString(8)} ${analyticalBounds.width.toString(8)} ${analyticalBounds.height.toString(8)}`;
					svgRootElement.setAttribute('viewBox', viewBoxString);
				}
			}
			if (this.showOriginAxes && viewBoxString) {
				const parts = viewBoxString.trim().split(/[\s,]+/).map(Number);
				if (parts.length === 4 && !parts.some(Number.isNaN)) {
					const [minX, minY, width, height] = parts;
					const strokeScale = Math.max(width, height) * 0.004;
					const axisGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
					axisGroup.setAttribute('pointer-events', 'none');
					axisGroup.innerHTML = `
						<line x1='${minX - width}' y1='0' x2='${minX + width * 2}' y2='0' stroke='currentColor' stroke-opacity='0.35' stroke-width='${strokeScale}' stroke-dasharray='${strokeScale * 3}'/>
						<line x1='0' y1='${minY - height}' x2='0' y2='${minY + height * 2}' stroke='currentColor' stroke-opacity='0.35' stroke-width='${strokeScale}' stroke-dasharray='${strokeScale * 3}'/>
						<circle cx='0' cy='0' r='${strokeScale * 2.5}' fill='none' stroke='currentColor' stroke-opacity='0.6' stroke-width='${strokeScale}'/>
					`;
					svgRootElement.appendChild(axisGroup);
				}
			}
			svgRootElement.setAttribute('width', '100%');
			svgRootElement.setAttribute('height', '100%');
			svgRootElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
			return { svgRootElement, viewBoxString };
		};

		try {
			const beforePrepared = prepareFittedSvgElement(this.lastInputSvg);
			const afterPrepared = prepareFittedSvgElement(this.lastOutputSvg);
			beforeMount.appendChild(beforePrepared.svgRootElement);
			afterMount.appendChild(afterPrepared.svgRootElement);
			viewBoxMetricsLabel.textContent = afterPrepared.viewBoxString ? `viewBox: ${afterPrepared.viewBoxString}` : 'No viewBox';

			if (this.previewMode === 'overlay') {
				afterSlotTag.textContent = 'Overlay';
				const overlayClone = prepareFittedSvgElement(this.lastInputSvg).svgRootElement;
				overlayClone.style.cssText = 'position:absolute;inset:0;opacity:0.45;filter:invert(1);pointer-events:none;';
				afterMount.appendChild(overlayClone);
			} else {
				afterSlotTag.textContent = 'Out';
			}
		} catch {
			viewBoxMetricsLabel.textContent = 'Preview error';
		}
	}

	updateMetricsBar(inputSvg, outputSvg) {
		const inputBytes = new Blob([inputSvg]).size;
		const outputBytes = new Blob([outputSvg]).size;
		const deltaPercent = inputBytes > 0 ? Math.round(((outputBytes - inputBytes) / inputBytes) * 100) : 0;
		const signPrefix = deltaPercent > 0 ? '+' : '';
		document.getElementById('inputMetricsLabel').textContent = `${inputBytes} B`;
		document.getElementById('outputMetricsLabel').textContent = `${outputBytes} B (${signPrefix}${deltaPercent}%)`;
	}

	clearOutputWorkspace() {
		document.getElementById('codeOutputViewer').innerHTML = '';
		document.getElementById('beforeSvgMount').innerHTML = '';
		document.getElementById('afterSvgMount').innerHTML = '';
		document.getElementById('inputMetricsLabel').textContent = '0 B';
		document.getElementById('outputMetricsLabel').textContent = '0 B';
		document.getElementById('viewBoxMetricsLabel').textContent = '—';
		document.getElementById('copyOutputButton').disabled = true;
		document.getElementById('downloadOutputButton').disabled = true;
		this.renderPrecisionDisclaimerState([]);
		this.hideErrorBanner();
	}

	updateHistoryBadgeCount() {
		document.getElementById('historyCounterBadge').textContent = String(LocalHistoryStorage.retrieveEntries().length);
	}

	renderHistoryList() {
		const listContainer = document.getElementById('historyListContainer');
		const entries = LocalHistoryStorage.retrieveEntries();
		if (entries.length === 0) {
			listContainer.innerHTML = `<div class='metric-label' style='padding:1rem;text-align:center;'>Empty</div>`;
			return;
		}
		listContainer.innerHTML = entries.map((entry) => `
			<div class='history-card'>
				<div class='history-meta'>
					<span>${entry.toolIdentifier.toUpperCase()}</span>
					<span>${entry.timestamp}</span>
				</div>
				<div style='font-size:var(--font-size-xs);font-weight:600;word-break:break-all;'>${FormatAndDiffEngine.escapeHtmlEntities(entry.fileName)}</div>
				<div class='pane-controls'>
					<button type='button' class='action-button primary-action' data-restore-entry='${entry.identifier}'>Load</button>
					<button type='button' class='action-button' data-download-entry='${entry.identifier}'>Save</button>
					<button type='button' class='action-button' data-delete-entry='${entry.identifier}' title='Delete Entry' style='margin-left:auto;'>${renderSvgIconMarkup('trash-2')}</button>
				</div>
			</div>
		`).join('');

		for (const restoreButton of Array.from(listContainer.querySelectorAll('[data-restore-entry]'))) {
			restoreButton.addEventListener('click', () => {
				const targetEntry = LocalHistoryStorage.retrieveEntries().find(
					(item) => item.identifier === restoreButton.getAttribute('data-restore-entry')
				);
				if (targetEntry) {
					this.currentFileName = targetEntry.fileName;
					document.getElementById('svgInputTextArea').value = targetEntry.inputSvg;
					this.processCurrentSvgInput(false);
					document.getElementById('historyDrawer').setAttribute('aria-hidden', 'true');
				}
			});
		}

		for (const downloadButton of Array.from(listContainer.querySelectorAll('[data-download-entry]'))) {
			downloadButton.addEventListener('click', () => {
				const targetEntry = LocalHistoryStorage.retrieveEntries().find(
					(item) => item.identifier === downloadButton.getAttribute('data-download-entry')
				);
				if (targetEntry) {
					this.downloadSvgFile(targetEntry.outputSvg, targetEntry.fileName);
				}
			});
		}

		for (const deleteButton of Array.from(listContainer.querySelectorAll('[data-delete-entry]'))) {
			deleteButton.addEventListener('click', () => {
				LocalHistoryStorage.removeEntry(deleteButton.getAttribute('data-delete-entry'));
				this.renderHistoryList();
				this.updateHistoryBadgeCount();
			});
		}
	}

	downloadSvgFile(svgContent, fileName) {
		const blobObject = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
		const objectUrl = URL.createObjectURL(blobObject);
		const downloadAnchor = document.createElement('a');
		const baseName = (fileName || 'vector.svg').replace(/\.svg$/i, '');
		downloadAnchor.href = objectUrl;
		downloadAnchor.download = `${baseName}-${this.activeToolIdentifier}.svg`;
		document.body.appendChild(downloadAnchor);
		downloadAnchor.click();
		document.body.removeChild(downloadAnchor);
		URL.revokeObjectURL(objectUrl);
	}

	showErrorBanner(errorMessage) {
		const banner = document.getElementById('errorBanner');
		banner.textContent = errorMessage;
		banner.hidden = false;
	}

	hideErrorBanner() {
		const banner = document.getElementById('errorBanner');
		banner.textContent = '';
		banner.hidden = true;
	}

	loadInitialDemonstrationSvg() {
		const sampleSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='160' viewBox='-20 -20 200 160'>
	<metadata>Vector Metadata</metadata>
	<g id='layer-one' transform='translate(15.25 12.5) scale(1.25)'>
		<rect x='8' y='8' width='64' height='48' rx='6' fill='none' stroke='currentColor' stroke-width='2'/>
		<circle cx='84.5' cy='32.25' r='20' fill='none' stroke='currentColor' stroke-width='2'/>
		<path id='cubic-curve' d='M 8 72.125 L 52.5 92.25 C 72.125 98.5 96.25 84.5 112.5 60.25 Z' fill='none' stroke='currentColor' stroke-width='2'/>
	</g>
</svg>`;
		document.getElementById('svgInputTextArea').value = sampleSvg;
		this.processCurrentSvgInput(false);
	}
}

document.addEventListener('DOMContentLoaded', () => {
	window.svgSuiteController = new ApplicationStateController();
});