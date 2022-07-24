// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { TextEncoder } from 'util';
import * as vscode from 'vscode';

const gClock: Date = new Date();

function getDate(): string
{
	return `${gClock.getDate()}/${gClock.getMonth()}/${gClock.getFullYear()}`;
}

function processString(source: string, username?: string, copyright?: string, namespaceName?: string, className?: string, headerName?: string): string
{
	let result = source;
	result = result.replace(/<%userName%>/g, username!);
	result = result.replace(/<%copyright%>/g, copyright!);
	result = result.replace(/<%date%>/g, getDate());
	if (namespaceName! !== "")
	{
		result = result.replace(/<%namespaceStart%>/g, `namespace ${namespaceName!} {`);
		result = result.replace(/<%namespaceEnd%>/g, `} // ${namespaceName}`);
	}
	else
	{
		result = result.replace(/<%namespaceStart%>/g, "");
		result = result.replace(/<%namespaceEnd%>/g, "");
	}
	result = result.replace(/<%className%>/g, className!);
	result = result.replace(/<%headerFileName%>/g, headerName!);
	return result;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('cpp-class-generator is now active!');

	let disposable = vscode.commands.registerCommand('cpp-class-generator.createClass', async (path:vscode.Uri) => { // Code
		// TODO: Refactor
		let config = vscode.workspace.getConfiguration("cpp-class-generator");
		let username = String(config.get("user.name"));
		let copyright = processString(String(config.get("project.copyright")), username);
		let fullClassNameInput = await vscode.window.showInputBox(
			{
				"placeHolder": "ClassName",
				"prompt": "Enter class name (e.g. SomeClass / MyNamespace::MyOtherNamespace::SomeClass)",
				"value": ""
			}
		);
		if (fullClassNameInput === undefined) return;
		let fullClassName = String(fullClassNameInput);
		let namespaceSeparatorPos = fullClassName.lastIndexOf("::");
		let namespaceName = fullClassName.slice(0, namespaceSeparatorPos);
		let className = fullClassName.slice(namespaceSeparatorPos + 2, fullClassName.length);
		const filenameInput = await vscode.window.showInputBox(
			{
				"placeHolder": "Filename",
				"prompt": "Enter filename without extension",
				"value": className
			}
		);
		if (filenameInput === undefined) return;
		let filename = String(filenameInput);
		let isSingleFilePick = await vscode.window.showQuickPick(
			["Single file", "Separate Header/Source"]
		);
		if (isSingleFilePick === undefined) return;
		let isSingleFile = (String(isSingleFilePick) === "Single file");
		let sourcePath = path.path;
		if (sourcePath === "") return;

		let headerExt = String(config.get("templates.header-extension"));
		let sourceExt = String(config.get("templates.source-extension"));
		let singleHeaderExt = String(config.get("templates.single-header-extension"));
		const encoder = new TextEncoder();
		
		if (!isSingleFile)
		{
			let headerfile = processString(String(config.get("templates.header")), username, copyright, namespaceName, className, `<${filename}${headerExt}>`);
			vscode.workspace.fs.writeFile(
				vscode.Uri.file(`${sourcePath}/${filename}${headerExt}`),
				encoder.encode(headerfile)
			)
			let sourcefile = processString(String(config.get("templates.source")), username, copyright, namespaceName, className, `<${filename}${sourceExt}>`);
			vscode.workspace.fs.writeFile(
				vscode.Uri.file(`${sourcePath}/${filename}${sourceExt}`),
				encoder.encode(sourcefile)
			)
		}
		else
		{
			let headerfile = processString(String(config.get("templates.header")), username, copyright, namespaceName, className, `<${filename}${singleHeaderExt}>`);
			vscode.workspace.fs.writeFile(
				vscode.Uri.file(`${sourcePath}/${filename}${singleHeaderExt}`),
				encoder.encode(headerfile)
			)
		}
		vscode.window.showInformationMessage("Done!");
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() 
{
	console.log('cpp-class-generator deactivated');
}
