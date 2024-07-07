import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
    outputChannel = vscode.window.createOutputChannel("jPaste");
    outputChannel.show();
    outputChannel.appendLine('jPaste extension is now active');

    let jPasteDisposable = vscode.commands.registerTextEditorCommand('extension.jPaste', jPaste);
    context.subscriptions.push(jPasteDisposable);

    vscode.commands.executeCommand('workbench.action.output.show', 'jPaste');
}

export function deactivate() {}

function jPaste(textEditor: vscode.TextEditor): void {
    outputChannel.appendLine('jPaste function called');

    vscode.env.clipboard.readText().then(clipboardContent => {
        outputChannel.appendLine('Clipboard content read');

        const documentContent = textEditor.document.getText();
        outputChannel.appendLine('Document content read');

        const documentLines = documentContent.split('\n');
        const clipboardLines = clipboardContent.split('\n');

        let mergedLines: string[] = [];
        let documentIndex = 0;
        let clipboardIndex = 0;
        let mainExecutionBlock: string[] = [];

        while (documentIndex < documentLines.length || clipboardIndex < clipboardLines.length) {
            if (documentIndex < documentLines.length && 
                (documentLines[documentIndex].trim().startsWith('if __name__ == "__main__"') || 
                 documentLines[documentIndex].trim().startsWith("if __name__ == '__main__'"))) {
                // We've reached the main execution block in the document
                // Collect all remaining lines from the document
                while (documentIndex < documentLines.length) {
                    mainExecutionBlock.push(documentLines[documentIndex]);
                    documentIndex++;
                }
                break;
            }

            if (clipboardIndex < clipboardLines.length && 
                (clipboardLines[clipboardIndex].trim().startsWith('if __name__ == "__main__"') || 
                 clipboardLines[clipboardIndex].trim().startsWith("if __name__ == '__main__'"))) {
                // We've reached the main execution block in the clipboard
                // Collect all remaining lines from the clipboard
                while (clipboardIndex < clipboardLines.length) {
                    mainExecutionBlock.push(clipboardLines[clipboardIndex]);
                    clipboardIndex++;
                }
                break;
            }

            if (documentIndex < documentLines.length && clipboardIndex < clipboardLines.length &&
                documentLines[documentIndex] === clipboardLines[clipboardIndex]) {
                // Lines are the same, keep the original line
                mergedLines.push(documentLines[documentIndex]);
                outputChannel.appendLine(`Kept line ${documentIndex + 1}: ${documentLines[documentIndex].substring(0, 50)}...`);
                documentIndex++;
                clipboardIndex++;
            } else if (clipboardIndex < clipboardLines.length &&
                       (documentIndex >= documentLines.length || !documentLines.includes(clipboardLines[clipboardIndex]))) {
                // New line from clipboard, add it if it's not a placeholder comment
                if (!isPlaceholderComment(clipboardLines[clipboardIndex])) {
                    mergedLines.push(clipboardLines[clipboardIndex]);
                    outputChannel.appendLine(`Added line: ${clipboardLines[clipboardIndex].substring(0, 50)}...`);
                } else {
                    outputChannel.appendLine(`Skipped placeholder comment: ${clipboardLines[clipboardIndex]}`);
                }
                clipboardIndex++;
            } else {
                // Line exists in document but not in clipboard, keep it
                mergedLines.push(documentLines[documentIndex]);
                outputChannel.appendLine(`Kept original line ${documentIndex + 1}: ${documentLines[documentIndex].substring(0, 50)}...`);
                documentIndex++;
            }
        }

        // Append the main execution block at the end
        if (mainExecutionBlock.length > 0) {
            mergedLines.push('');  // Add a blank line before the main execution block
            mergedLines = mergedLines.concat(mainExecutionBlock);
            outputChannel.appendLine('Appended main execution block at the end');
        }

        const newContent = mergedLines.join('\n');

        const fullRange = new vscode.Range(
            textEditor.document.positionAt(0),
            textEditor.document.positionAt(documentContent.length)
        );

        return textEditor.edit(editBuilder => {
            editBuilder.replace(fullRange, newContent);
        });
    }).then(editSucceeded => {
        if (editSucceeded) {
            outputChannel.appendLine('jPaste operation completed successfully');
            vscode.window.showInformationMessage('jPaste operation completed successfully');
        } else {
            outputChannel.appendLine('jPaste operation failed');
            vscode.window.showErrorMessage('jPaste operation failed');
        }
    }, (error: Error) => {
        outputChannel.appendLine(`Error in jPaste: ${error.message}`);
        console.error('Error in jPaste:', error);
        vscode.window.showErrorMessage('jPaste encountered an error: ' + error.message);
    });
}

function isPlaceholderComment(line: string): boolean {
    const trimmedLine = line.trim();
    return trimmedLine.startsWith('# ...') || 
           trimmedLine.startsWith('// ...') ||
           trimmedLine.includes('(other methods remain the same)') ||
           trimmedLine.includes('(main execution remains the same)');
}