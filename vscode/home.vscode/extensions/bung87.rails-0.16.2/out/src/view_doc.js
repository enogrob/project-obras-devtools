"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const path = require("path");
const axios_1 = require("axios");
const rails_1 = require("./symbols/rails");
const ruby_1 = require("./symbols/ruby");
const url = require("url");
// Track currently webview panel
// var currentPanel: vscode.WebviewPanel | undefined = undefined;
function injectBase(html, base) {
    let policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; img-src vscode-resource: http:; script-src vscode-resource: http: 'unsafe-inline' ; style-src vscode-resource: http: 'unsafe-inline';">`;
    let _base = path.dirname(base) + "/";
    // Remove any <base> elements inside <head>
    var _html = html.replace(/(<[^>/]*head[^>]*>)[\s\S]*?(<[^>/]*base[^>]*>)[\s\S]*?(<[^>]*head[^>]*>)/gim, "$1 $3");
    // // Add <base> just before </head>
    // html = html.replace(
    //   /(<[^>/]*head[^>]*>[\s\S]*?)(<[^>]*head[^>]*>)/gim,
    // );
    _html = _html.replace(/<head>/gim, `<head><base href="${_base}">\n${policy}\n<style> body{margin:20px;}</style>`);
    return _html;
}
const CancelToken = axios_1.default.CancelToken;
const source = CancelToken.source();
function showSide(symbol, html, context) {
    const columnToShowIn = vscode.window.activeTextEditor
        ? vscode.window.activeTextEditor.viewColumn
        : undefined;
    // if (currentPanel) {
    //   // If we already have a panel, show it in the target column
    //   currentPanel.webview.html = html;
    //   currentPanel.title = `Document ${symbol}`;
    //   currentPanel.reveal(columnToShowIn);
    // } else {
    let currentPanel = vscode.window.createWebviewPanel("Document", `Document ${symbol}`, vscode.ViewColumn.Two, {
        // Enable scripts in the webview
        enableScripts: true,
        retainContextWhenHidden: true
    });
    currentPanel.webview.html = html;
    // Reset when the current panel is closed
    // currentPanel.onDidDispose(
    //   () => {
    //     currentPanel = undefined;
    //     source.cancel('request canceled as WebviewPanel Disposed.');
    //   },
    //   null,
    //   context.subscriptions
    // );
}
function doRequest(_url, symbol) {
    let context = this;
    let request = axios_1.default({ url: url.parse(_url), timeout: 5e3, cancelToken: source.token })
        .then(function (r) {
        if (typeof r.data == "string") {
            let html = injectBase(r.data, _url);
            showSide(symbol, html, context);
        }
        else {
            let html = "No valid response content.";
            showSide(symbol, html, context);
        }
    })
        .catch(function (err) {
        console.error(err);
        showSide(symbol, err.toString(), context);
    });
}
function viewDoc() {
    let context = this;
    let document = vscode.window.activeTextEditor.document;
    let position = vscode.window.activeTextEditor.selection.active;
    let wordRange = document.getWordRangeAtPosition(position);
    let word = document.getText(wordRange);
    let lineStartToWord = document
        .getText(new vscode.Range(new vscode.Position(position.line, 0), wordRange.end))
        .trim();
    let symbol = new RegExp("(((::)?[A-Za-z]+)*(::)?" + word + ")").exec(lineStartToWord)[1];
    console.log(`symbol:${symbol}`);
    var endpoint = "";
    var is_rails_symbol = rails_1.RAILS.has(symbol.toLowerCase());
    var is_ruby_symbol = ruby_1.RUBY.has(symbol.toLowerCase());
    if (symbol && (is_rails_symbol || is_ruby_symbol)) {
        endpoint = symbol.replace("::", "/");
    }
    console.log(`symbol:${symbol},endpoint:${endpoint}`);
    if (endpoint == null) {
        return;
    }
    var url = '';
    if (is_ruby_symbol) {
        url = `http://docs.rubydocs.org/ruby-${ruby_1.VERSION.replace(/\./g, "-")}/classes/${endpoint}.html`;
    }
    else if (is_rails_symbol) {
        url = `http://api.rubyonrails.org/classes/${endpoint}.html`;
    }
    else {
        showSide(symbol, "No matched symbol on extension side.", context);
        return;
    }
    console.log(is_rails_symbol, is_ruby_symbol, url);
    // let info = vscode.window.showInformationMessage("Rails:Document-loading...")
    doRequest.call(context, url, symbol);
}
exports.viewDoc = viewDoc;
//# sourceMappingURL=view_doc.js.map