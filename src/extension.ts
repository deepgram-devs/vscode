import * as vscode from 'vscode';
import { DeepgramViewProvider } from './deepgramViewProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new DeepgramViewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'deepgramPanel',
            provider
        )
    );
}

export function deactivate() {}
