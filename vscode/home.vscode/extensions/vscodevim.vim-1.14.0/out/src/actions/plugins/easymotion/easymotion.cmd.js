"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
const position_1 = require("./../../../common/motion/position");
const configuration_1 = require("./../../../configuration/configuration");
const mode_1 = require("./../../../mode/mode");
const base_1 = require("./../../base");
const actions_1 = require("./../../commands/actions");
const easymotion_1 = require("./easymotion");
const globalState_1 = require("../../../state/globalState");
const textEditor_1 = require("../../../textEditor");
function buildTriggerKeys(trigger) {
    return [
        ...Array.from({ length: trigger.leaderCount || 2 }, () => '<leader>'),
        ...trigger.key.split(''),
    ];
}
exports.buildTriggerKeys = buildTriggerKeys;
class BaseEasyMotionCommand extends actions_1.BaseCommand {
    constructor(baseOptions, trigger) {
        super();
        this.modes = [mode_1.Mode.Normal, mode_1.Mode.Visual, mode_1.Mode.VisualLine, mode_1.Mode.VisualBlock];
        this._baseOptions = baseOptions;
        if (trigger) {
            this.keys = buildTriggerKeys(trigger);
        }
    }
    processMarkers(matches, cursorPosition, vimState) {
        // Clear existing markers, just in case
        vimState.easyMotion.clearMarkers();
        let index = 0;
        const markerGenerator = easymotion_1.EasyMotion.createMarkerGenerator(matches.length);
        for (const match of matches) {
            const matchPosition = this.resolveMatchPosition(match);
            // Skip if the match position equals to cursor position
            if (!matchPosition.isEqual(cursorPosition)) {
                const marker = markerGenerator.generateMarker(index++, matchPosition);
                if (marker) {
                    vimState.easyMotion.addMarker(marker);
                }
            }
        }
    }
    searchOptions(position) {
        switch (this._baseOptions.searchOptions) {
            case 'min':
                return { min: position };
            case 'max':
                return { max: position };
            default:
                return {};
        }
    }
    async exec(position, vimState) {
        // Only execute the action if the configuration is set
        if (!configuration_1.configuration.easymotion) {
            return vimState;
        }
        else {
            // Search all occurences of the character pressed
            const matches = this.getMatches(position, vimState);
            // If previous mode was visual, restore visual selection
            if (mode_1.isVisualMode(vimState.easyMotion.previousMode)) {
                vimState.cursorStartPosition = vimState.lastVisualSelection.start;
                vimState.cursorStopPosition = vimState.lastVisualSelection.end;
                vimState.visualLineStartColumn = vimState.lastVisualSelection.visualLineStartColumn;
            }
            // Stop if there are no matches
            if (matches.length === 0) {
                return vimState;
            }
            else {
                vimState.easyMotion = new easymotion_1.EasyMotion();
                this.processMarkers(matches, position, vimState);
                if (matches.length === 1) {
                    // Only one found, navigate to it
                    const marker = vimState.easyMotion.markers[0];
                    // Set cursor position based on marker entered
                    vimState.cursorStopPosition = marker.position;
                    vimState.easyMotion.clearDecorations();
                    return vimState;
                }
                else {
                    // Store mode to return to after performing easy motion
                    vimState.easyMotion.previousMode = vimState.currentMode;
                    // Enter the EasyMotion mode and await further keys
                    await vimState.setCurrentMode(mode_1.Mode.EasyMotionMode);
                    return vimState;
                }
            }
        }
    }
}
function getMatchesForString(position, vimState, searchString, options) {
    switch (searchString) {
        case '':
            return [];
        case ' ':
            // Searching for space should only find the first space
            return vimState.easyMotion.sortedSearch(position, new RegExp(' {1,}', 'g'), options);
        default:
            // Search all occurences of the character pressed
            // If the input is not a letter, treating it as regex can cause issues
            if (!/[a-zA-Z]/.test(searchString)) {
                return vimState.easyMotion.sortedSearch(position, searchString, options);
            }
            const ignorecase = configuration_1.configuration.ignorecase && !(configuration_1.configuration.smartcase && /[A-Z]/.test(searchString));
            const regexFlags = ignorecase ? 'gi' : 'g';
            return vimState.easyMotion.sortedSearch(position, new RegExp(searchString, regexFlags), options);
    }
}
class SearchByCharCommand extends BaseEasyMotionCommand {
    constructor(options) {
        super(options);
        this._searchString = '';
        this._options = options;
    }
    get searchCharCount() {
        return this._options.charCount;
    }
    getMatches(position, vimState) {
        return getMatchesForString(position, vimState, this._searchString, this.searchOptions(position));
    }
    updateSearchString(s) {
        this._searchString = s;
    }
    getSearchString() {
        return this._searchString;
    }
    shouldFire() {
        const charCount = this._options.charCount;
        return charCount ? this._searchString.length >= charCount : true;
    }
    fire(position, vimState) {
        return this.exec(position, vimState);
    }
    resolveMatchPosition(match) {
        const { line, character } = match.position;
        switch (this._options.labelPosition) {
            case 'after':
                return new position_1.Position(line, character + this._options.charCount);
            case 'before':
                return new position_1.Position(line, Math.max(0, character - 1));
            default:
                return match.position;
        }
    }
}
exports.SearchByCharCommand = SearchByCharCommand;
class SearchByNCharCommand extends BaseEasyMotionCommand {
    constructor() {
        super({});
        this._searchString = '';
    }
    get searchCharCount() {
        return -1;
    }
    resolveMatchPosition(match) {
        return match.position;
    }
    updateSearchString(s) {
        this._searchString = s;
    }
    getSearchString() {
        return this._searchString;
    }
    getMatches(position, vimState) {
        return getMatchesForString(position, vimState, this.removeTrailingLineBreak(this._searchString), {});
    }
    removeTrailingLineBreak(s) {
        return s.replace(new RegExp('\n+$', 'g'), '');
    }
    shouldFire() {
        // Fire when <CR> typed
        return this._searchString.endsWith('\n');
    }
    async fire(position, vimState) {
        if (this.removeTrailingLineBreak(this._searchString) === '') {
            return vimState;
        }
        else {
            return this.exec(position, vimState);
        }
    }
}
exports.SearchByNCharCommand = SearchByNCharCommand;
class EasyMotionCharMoveCommandBase extends actions_1.BaseCommand {
    constructor(trigger, action) {
        super();
        this.modes = [mode_1.Mode.Normal, mode_1.Mode.Visual, mode_1.Mode.VisualLine, mode_1.Mode.VisualBlock];
        this._action = action;
        this.keys = buildTriggerKeys(trigger);
    }
    async exec(position, vimState) {
        // Only execute the action if easymotion is enabled
        if (!configuration_1.configuration.easymotion) {
            return vimState;
        }
        else {
            vimState.easyMotion = new easymotion_1.EasyMotion();
            vimState.easyMotion.previousMode = vimState.currentMode;
            vimState.easyMotion.searchAction = this._action;
            globalState_1.globalState.hl = true;
            await vimState.setCurrentMode(mode_1.Mode.EasyMotionInputMode);
            return vimState;
        }
    }
}
exports.EasyMotionCharMoveCommandBase = EasyMotionCharMoveCommandBase;
class EasyMotionWordMoveCommandBase extends BaseEasyMotionCommand {
    constructor(trigger, options = {}) {
        super(options, trigger);
        this._options = options;
    }
    getMatches(position, vimState) {
        return this.getMatchesForWord(position, vimState, this.searchOptions(position));
    }
    resolveMatchPosition(match) {
        const { line, character } = match.position;
        switch (this._options.labelPosition) {
            case 'after':
                return new position_1.Position(line, character + match.text.length - 1);
            default:
                return match.position;
        }
    }
    getMatchesForWord(position, vimState, options) {
        const regex = this._options.jumpToAnywhere
            ? new RegExp(configuration_1.configuration.easymotionJumpToAnywhereRegex, 'g')
            : new RegExp('\\w{1,}', 'g');
        return vimState.easyMotion.sortedSearch(position, regex, options);
    }
}
exports.EasyMotionWordMoveCommandBase = EasyMotionWordMoveCommandBase;
class EasyMotionLineMoveCommandBase extends BaseEasyMotionCommand {
    constructor(trigger, options = {}) {
        super(options, trigger);
        this._options = options;
    }
    resolveMatchPosition(match) {
        return match.position;
    }
    getMatches(position, vimState) {
        return this.getMatchesForLineStart(position, vimState, this.searchOptions(position));
    }
    getMatchesForLineStart(position, vimState, options) {
        // Search for the beginning of all non whitespace chars on each line before the cursor
        const matches = vimState.easyMotion.sortedSearch(position, new RegExp('^.', 'gm'), options);
        for (const match of matches) {
            match.position = textEditor_1.TextEditor.getFirstNonWhitespaceCharOnLine(match.position.line);
        }
        return matches;
    }
}
exports.EasyMotionLineMoveCommandBase = EasyMotionLineMoveCommandBase;
let EasyMotionCharInputMode = class EasyMotionCharInputMode extends actions_1.BaseCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.Mode.EasyMotionInputMode];
        this.keys = ['<character>'];
    }
    async exec(position, vimState) {
        const key = this.keysPressed[0];
        const action = vimState.easyMotion.searchAction;
        const oldSearchString = action.getSearchString();
        const newSearchString = key === '<BS>' || key === '<shift+BS>' ? oldSearchString.slice(0, -1) : oldSearchString + key;
        action.updateSearchString(newSearchString);
        if (action.shouldFire()) {
            // Skip Easymotion input mode to make sure not to back to it
            await vimState.setCurrentMode(vimState.easyMotion.previousMode);
            const state = await action.fire(vimState.cursorStopPosition, vimState);
            return state;
        }
        return vimState;
    }
};
EasyMotionCharInputMode = __decorate([
    base_1.RegisterAction
], EasyMotionCharInputMode);
let CommandEscEasyMotionCharInputMode = class CommandEscEasyMotionCharInputMode extends actions_1.BaseCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.Mode.EasyMotionInputMode];
        this.keys = ['<Esc>'];
    }
    async exec(position, vimState) {
        await vimState.setCurrentMode(mode_1.Mode.Normal);
        return vimState;
    }
};
CommandEscEasyMotionCharInputMode = __decorate([
    base_1.RegisterAction
], CommandEscEasyMotionCharInputMode);
let MoveEasyMotion = class MoveEasyMotion extends actions_1.BaseCommand {
    constructor() {
        super(...arguments);
        this.modes = [mode_1.Mode.EasyMotionMode];
        this.keys = ['<character>'];
    }
    async exec(position, vimState) {
        const key = this.keysPressed[0];
        if (!key) {
            return vimState;
        }
        else {
            // "nail" refers to the accumulated depth keys
            const nail = vimState.easyMotion.accumulation + key;
            vimState.easyMotion.accumulation = nail;
            // Find markers starting with "nail"
            const markers = vimState.easyMotion.findMarkers(nail, true);
            // If previous mode was visual, restore visual selection
            if (mode_1.isVisualMode(vimState.easyMotion.previousMode)) {
                vimState.cursorStartPosition = vimState.lastVisualSelection.start;
                vimState.cursorStopPosition = vimState.lastVisualSelection.end;
                vimState.visualLineStartColumn = vimState.lastVisualSelection.visualLineStartColumn;
            }
            if (markers.length === 1) {
                // Only one found, navigate to it
                const marker = markers[0];
                vimState.easyMotion.clearDecorations();
                // Restore the mode from before easy motion
                await vimState.setCurrentMode(vimState.easyMotion.previousMode);
                // Set cursor position based on marker entered
                vimState.cursorStopPosition = marker.position;
                return vimState;
            }
            else {
                if (markers.length === 0) {
                    // None found, exit mode
                    vimState.easyMotion.clearDecorations();
                    await vimState.setCurrentMode(vimState.easyMotion.previousMode);
                    return vimState;
                }
                else {
                    return vimState;
                }
            }
        }
    }
};
MoveEasyMotion = __decorate([
    base_1.RegisterAction
], MoveEasyMotion);

//# sourceMappingURL=easymotion.cmd.js.map
