"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const jsbeautify = require("js-beautify");
function format(document, range) {
    if (range === null) {
        var start = new vscode.Position(0, 0);
        var end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        range = new vscode.Range(start, end);
    }
    var result = [];
    var content = document.getText(range);
    var formatted = beatify(content, document.languageId);
    if (formatted) {
        result.push(new vscode.TextEdit(range, formatted));
    }
    return result;
}
exports.format = format;
;
function beatify(documentContent, languageId) {
    var beatiFunc = null;
    switch (languageId) {
        case 'scss.erb':
            languageId = 'css';
            beatiFunc = jsbeautify.css;
        case 'css.erb':
            beatiFunc = jsbeautify.css;
            break;
        // case 'json':
        //     languageId = 'javascript';
        case 'js.erb':
            languageId = 'javascript';
            beatiFunc = jsbeautify.js;
            break;
        case 'html.erb':
            beatiFunc = jsbeautify.html;
            break;
        default:
            showMesage('Sorry, this language is not supported. Only support Javascript, CSS and HTML.');
            break;
    }
    if (!beatiFunc)
        return;
    var tabSize = null;
    var beutifyOptions = {};
    const prefix = languageId.split(".")[0];
    const config = vscode.workspace.getConfiguration('');
    try {
        tabSize = config[`[${prefix}`][`erb]`]["editor.tabSize"];
    }
    catch (e) {
        tabSize = vscode.workspace.getConfiguration("editor").get("tabSize");
    }
    if (tabSize != null) {
        beutifyOptions["indent_size"] = tabSize;
    }
    return beatiFunc(documentContent, beutifyOptions);
}
class Formatter {
    beautify() {
        // Create as needed
        let window = vscode.window;
        let range;
        // Get the current text editor
        let activeEditor = window.activeTextEditor;
        if (!activeEditor) {
            return;
        }
        let document = activeEditor.document;
        if (range === null) {
            var start = new vscode.Position(0, 0);
            var end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
            range = new vscode.Range(start, end);
        }
        // var result: vscode.TextEdit[] = [];
        var content = document.getText(range);
        var formatted = beatify(content, document.languageId);
        if (formatted) {
            return activeEditor.edit(function (editor) {
                var start = new vscode.Position(0, 0);
                var end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
                range = new vscode.Range(start, end);
                return editor.replace(range, formatted);
            });
        }
    }
    registerBeautify(range) {
        // Create as needed
        let window = vscode.window;
        // Get the current text editor
        let editor = window.activeTextEditor;
        if (!editor) {
            return;
        }
        let document = editor.document;
        return format(document, range);
    }
    onSave(e) {
        var { document } = e;
        var docType = ['css.erb', 'scss.erb', 'html.erb'];
        if (docType.indexOf(document.languageId) == -1) {
            return;
        }
        const prefix = document.languageId.split(".")[0];
        var onSave = false;
        const config = vscode.workspace.getConfiguration('', e.document);
        try {
            onSave = config[`[${prefix}`][`erb]`]["editor.formatOnSave"];
        }
        catch (e) {
            onSave = vscode.workspace.getConfiguration("editor").get("formatOnSave");
        }
        if (!onSave) {
            return;
        }
        var start = new vscode.Position(0, 0);
        var end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
        var range = new vscode.Range(start, end);
        var result = [];
        var content = document.getText(range);
        var formatted = beatify(content, document.languageId);
        if (formatted) {
            var start = new vscode.Position(0, 0);
            var end = new vscode.Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
            range = new vscode.Range(start, end);
            var edit = vscode.TextEdit.replace(range, formatted);
            e.waitUntil(Promise.resolve([edit]));
        }
    }
}
exports.Formatter = Formatter;
function showMesage(msg) {
    vscode.window.showInformationMessage(msg);
}
//# sourceMappingURL=formatter.js.map