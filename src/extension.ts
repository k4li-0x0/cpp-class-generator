// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { writeFile } from 'fs';
import {
	userInfo
} from 'os';
import {
	TextEncoder
} from 'util';
import * as vscode from 'vscode';

const gClock: Date = new Date();

function getDate(): string {
	return `${gClock.getDate()}.${gClock.getMonth()}.${gClock.getFullYear()}`;
}


// Return text with replaced variables
function processString(source: string, username ? : string, copyright ? : string, namespaceName ? : string, className ? : string, headerName ? : string): string {
	let result = source;
	result = result.replace(/<%userName%>/g, username!);
	result = result.replace(/<%copyright%>/g, copyright!);
	result = result.replace(/<%date%>/g, getDate());
	if (namespaceName! !== "") {
		result = result.replace(/<%namespaceStart%>/g, `namespace ${namespaceName!} {`);
		result = result.replace(/<%namespaceEnd%>/g, `} // ${namespaceName!}`);
		result = result.replace(/<%namespaceTab%>/g, "\t");
	} else {
		result = result.replace(/<%namespaceStart%>/g, "");
		result = result.replace(/<%namespaceEnd%>/g, "");
		result = result.replace(/<%namespaceTab%>/g, "");
	}
	result = result.replace(/<%className%>/g, className!);
	result = result.replace(/<%headerFileName%>/g, headerName!);
	return result;
}

class FileFactory
{
	private static encoder = new TextEncoder();
	private static config = vscode.workspace.getConfiguration("cpp-class-generator");

	private ProcessFile(path: string, fileName: string, fileExtension: string, content: string) {
		vscode.workspace.fs.writeFile(
			vscode.Uri.file(`${path}/${fileName}${fileExtension}`),
			FileFactory.encoder.encode(content)
		)
	}

	private GetConfigParam(name: string) : unknown
	{
		return FileFactory.config.get(name);
	}

	private GetConfigParamAsString(name: string) : string
	{
		let result = this.GetConfigParam(name);
		if (result === null || result === undefined) return "";
		return String(FileFactory.config.get(name));
	}

	private async PrettyInputBox(placeHolder: string, prompt: string, value?: string) : Promise<string>
	{
		let mValue = "";
		mValue = value!;
		let result = await vscode.window.showInputBox({
			"placeHolder": placeHolder,
			"prompt": prompt,
			"value": mValue
		});
		if (result === undefined) return "";
		return result;
	}

	private async PrettyQuickPick(items: readonly string[] | Thenable<readonly string[]>, options?: vscode.QuickPickOptions) : Promise<string> 
	{
		let pick = await vscode.window.showQuickPick(
			items, 
			options
		);
		if (pick === undefined) return "";
		return pick;
	}

	/**
	 * CreateFile
	 */
	public async CreateFile(path: vscode.Uri) {
		let userName = this.GetConfigParamAsString("user.name");
		if (userName === "")
		{
			userName = userInfo().username;
		}
		let copyright = processString(this.GetConfigParamAsString("project.copyright"), userName);
		let fullClassNameInput = await this.PrettyInputBox("Class name", "Enter class name (e.g. SomeClass / MyNamespace::MyOtherNamespace::SomeClass)"); /*await vscode.window.showInputBox({
			"placeHolder": "ClassName",
			"prompt": "Enter class name (e.g. SomeClass / MyNamespace::MyOtherNamespace::SomeClass)",
			"value": ""
		});*/
		if (fullClassNameInput === undefined) return;
		let fullClassName = String(fullClassNameInput);
		let namespaceName = "";
		let className = "";
		let namespaceSeparatorPos = fullClassName.lastIndexOf("::");
		if (namespaceSeparatorPos != -1) {
			namespaceName = fullClassName.slice(0, namespaceSeparatorPos);
			className = fullClassName.slice(namespaceSeparatorPos + 2, fullClassName.length);
		} else {
			className = fullClassName;
		}
		const filenameInput = await this.PrettyInputBox("Filename", "Enter filename withour extension", className); /*await vscode.window.showInputBox({
			"placeHolder": "Filename",
			"prompt": "Enter filename without extension",
			"value": className
		});*/
		if (filenameInput === undefined) return;
		let filename = String(filenameInput);
		let isSingleFilePick = await this.PrettyQuickPick(
			["Single file", "Separate Header/Source"], 
			{
				canPickMany: false,
				title: "Choose which files will be created",
				placeHolder: "One file or two files?"
			}
		);
		if (String(isSingleFilePick) === "") return;
		let isSingleFile = (String(isSingleFilePick) === "Single file");
		let sourcePath = path.path;
		if (sourcePath === "") return;

		let headerExt = this.GetConfigParamAsString("templates.header-extension");
		let sourceExt = this.GetConfigParamAsString("templates.source-extension");
		let singleHeaderExt = this.GetConfigParamAsString("templates.single-header-extension");

		// Create files
		if (!isSingleFile) {
			let headerfile = processString(this.GetConfigParamAsString("templates.header"), userName, copyright, namespaceName, className, `<${filename}${headerExt}>`);
			this.ProcessFile(path.path, filename, headerExt, headerfile);
			let sourcefile = processString(this.GetConfigParamAsString("templates.source"), userName, copyright, namespaceName, className, `<${filename}${sourceExt}>`);
			this.ProcessFile(path.path, filename, sourceExt, sourcefile);
		} else {
			let headerfile = processString(this.GetConfigParamAsString("templates.header"), userName, copyright, namespaceName, className, `<${filename}${singleHeaderExt}>`);
			this.ProcessFile(path.path, filename, singleHeaderExt, headerfile);
		}
		vscode.window.showInformationMessage("Done!");
	}
};

export function activate(context: vscode.ExtensionContext) {
	console.log('cpp-class-generator is now active!');

	const factory = new FileFactory;

	let disposable = vscode.commands.registerCommand('cpp-class-generator.createClass', async (path: vscode.Uri) => { // Code
		// TODO: Refactor
		factory.CreateFile(path);
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('cpp-class-generator deactivated');
}