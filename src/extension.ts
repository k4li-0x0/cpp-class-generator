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

class FileFactory {
	private static encoder = new TextEncoder();
	private static config = vscode.workspace.getConfiguration("cpp-class-generator");
	private username: string = "User";
	private copyright: string = "";
	private namespaceName: string = "";
	private className: string = "";
	private headerName: string = "";
	private sourceName: string = "";

	private static UpdateConfig()
	{
		FileFactory.config = vscode.workspace.getConfiguration("cpp-class-generator");
	}

	private static getParameterFromConfig(name: string): unknown {
		return FileFactory.config.get(name);
	}

	private static getStringParameterFromConfig(name: string): string {
		let result = FileFactory.getParameterFromConfig(name);
		if (result === null || result === undefined) return "";
		return String(result);
	}

	private static getTemplateFromConfig(name: string): string {
		let result = FileFactory.getParameterFromConfig(name);
		if (result === null || result === undefined) return "";
		return (result as Array<any>).join('\n');
	}

	private static getDate(): string {
		let date: string = FileFactory.getStringParameterFromConfig("templates.date-format");
		let yyyy = gClock.getFullYear().toString();
		let yy = yyyy.slice(yyyy.length - 2);
		let mm = (gClock.getMonth() + 1).toString().padStart(2, '0');
		let dd = gClock.getDate().toString().padStart(2, '0');
		date = date.replace("YYYY", yyyy);
		date = date.replace("YY", yy);
		date = date.replace("MM", mm);
		date = date.replace("DD", dd);
		return date;
	}

	private processString(source: string, isHeader: boolean = false, isCopyright: boolean = false): string {
		let result = source;
		result = result.replace(/{userName}/g, this.username);
		result = result.replace(/{date}/g, FileFactory.getDate());
		if (isCopyright) return result;
		result = result.replace(/{copyright}/g, this.copyright);
		if (this.namespaceName! !== "") {
			result = result.replace(/{namespaceStart}/g, `namespace ${this.namespaceName} {`);
			result = result.replace(/{namespaceEnd}/g, `} // ${this.namespaceName}`);
			result = result.replace(/{namespaceTab}/g, "\t");
			result = result.replace(/{namespaceScope}/g, `${this.namespaceName}::`);
		} else {
			result = result.replace(/{namespaceStart}/g, "");
			result = result.replace(/{namespaceEnd}/g, "");
			result = result.replace(/{namespaceTab}/g, "");
			result = result.replace(/{namespaceScope}/g, "");
		}
		result = result.replace(/{className}/g, this.className);
		result = result.replace(/{headerFileName}/g, this.headerName);
		if (isHeader)
			result = result.replace(/{currentFileName}/g, this.headerName);
		else
			result = result.replace(/{currentFileName}/g, this.sourceName);
		return result;
	}


	private static ProcessFile(path: string, fileName: string, fileExtension: string, content: string) {
		vscode.workspace.fs.writeFile(
			vscode.Uri.file(`${path}/${fileName}${fileExtension}`),
			FileFactory.encoder.encode(content)
		)
	}

	private static async PrettyInputBox(placeHolder: string, prompt: string, value?: string): Promise<string | void> {
		let mValue = "";
		mValue = value!;
		let result = await vscode.window.showInputBox({
			"placeHolder": placeHolder,
			"prompt": prompt,
			"value": mValue
		});
		return result;
	}

	private static async PrettyQuickPick(items: readonly string[] | Thenable<readonly string[]>, options?: vscode.QuickPickOptions): Promise<string | void> {
		let pick = await vscode.window.showQuickPick(
			items,
			options
		);
		return Promise.resolve(pick);
	}

	/**
	 * CreateFile
	 */
	public async CreateFile(path: vscode.Uri) {
		FileFactory.UpdateConfig();
		this.username = FileFactory.getStringParameterFromConfig("user.name");
		if (this.username === "") {
			this.username = userInfo().username;
		}
		this.copyright = this.processString(FileFactory.getTemplateFromConfig("project.copyright"),false, true);
		let fullClassNameInput = await FileFactory.PrettyInputBox("Class name", "Enter class name (e.g. SomeClass / MyNamespace::MyOtherNamespace::SomeClass)");
		if (fullClassNameInput === undefined) return;
		let fullClassName = String(fullClassNameInput);
		let namespaceSeparatorPos = fullClassName.lastIndexOf("::");
		if (namespaceSeparatorPos != -1) {
			this.namespaceName = fullClassName.slice(0, namespaceSeparatorPos);
			this.className = fullClassName.slice(namespaceSeparatorPos + 2, fullClassName.length);
		} else {
			this.className = fullClassName;
		}
		const filenameInput = await FileFactory.PrettyInputBox("Filename", "Enter filename without extension", this.className);
		if (filenameInput === undefined) return;
		let filename = String(filenameInput);
		let isSingleFilePick = await FileFactory.PrettyQuickPick(
			["Default", "Separated Header/Source files", "Single file"],
			{
				canPickMany: false,
				title: "Choose which files will be created",
				placeHolder: "One file or two files?"
			}
		);
		if ((isSingleFilePick === undefined) ||
			(isSingleFilePick === "Default"))
			isSingleFilePick = FileFactory.getStringParameterFromConfig("templates.default-file-scheme");
		let isSingleFile = (isSingleFilePick === "Single file");
		let sourcePath = path.path;
		if (sourcePath === "") return;

		let headerExt = FileFactory.getStringParameterFromConfig("templates.header-extension");
		let sourceExt = FileFactory.getStringParameterFromConfig("templates.source-extension");
		let singleHeaderExt = FileFactory.getStringParameterFromConfig("templates.single-header-extension");
		this.sourceName = `${filename}${sourceExt}`;

		// Create files
		if (!isSingleFile) {
			let headerFileTemplate = FileFactory.getTemplateFromConfig("templates.header");
			let sourceFileTemplate = FileFactory.getTemplateFromConfig("templates.source");
			this.headerName = `${filename}${headerExt}`;
			let headerfile = this.processString(
				headerFileTemplate,
				true);
			FileFactory.ProcessFile(path.path, filename, headerExt, headerfile);
			let sourcefile = this.processString(
				sourceFileTemplate,
				false);
			FileFactory.ProcessFile(path.path, filename, sourceExt, sourcefile);
		} else {
			this.headerName = `${filename}${singleHeaderExt}`;
			let headerFileTemplate = FileFactory.getTemplateFromConfig("templates.header-only");
			if (headerFileTemplate.length == 0) headerFileTemplate = FileFactory.getTemplateFromConfig("templates.header");
			let headerfile = this.processString(
				headerFileTemplate,
				true);
			FileFactory.ProcessFile(path.path, filename, singleHeaderExt, headerfile);
		}
		vscode.window.showInformationMessage("C++ class generator: Done!");
	}
};

export function activate(context: vscode.ExtensionContext) {
	console.log('cpp-class-generator is now active!');

	let disposable = vscode.commands.registerCommand('cpp-class-generator.createClass', async (path: vscode.Uri) => { // Code
		let factory = new FileFactory;
		factory.CreateFile(path);
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('cpp-class-generator deactivated');
}