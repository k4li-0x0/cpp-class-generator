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
import { Config } from './config';
import * as api from 'vscode-cmake-tools';

const gClock: Date = new Date();
const gConfig: Config = new Config;

interface FileTemplate {
	string: string;
	templ: string;
}

class FileFactory {
	private static encoder = new TextEncoder();
	private username: string = "User";
	private copyright: string = "";
	private namespaceName: string = "";
	private className: string = "";
	private headerName: string = "";
	private sourceName: string = "";

	private static getDate(): string {
		let date = gConfig.getDateFormat();
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
			result = result.replace(/{namespaceStart}\r?\n?/g, "");
			result = result.replace(/\r?\n?{namespaceEnd}(\r?\n?)/g, "$1");
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

	private static async CmakeConfigure(uri: vscode.Uri) {
		const workspace = vscode.workspace.getWorkspaceFolder(uri);
		if (workspace === undefined) return;

		api.getCMakeToolsApi(api.Version.v1).then(api => {
			api?.getProject(workspace.uri).then(project => {
				project?.configure();
			});
		});
	}

	/**
	 * CreateFile
	 */
	public async CreateFile(path: vscode.Uri) {
		let templates = await gConfig.getAvailableNames();
		if (templates === undefined) {
			vscode.window.showErrorMessage("C++ class geerator: no any template present");
			return;
		}
		this.username = gConfig.getUserName();
		if (this.username === "") {
			this.username = userInfo().username;
		}
		this.copyright = this.processString(gConfig.getCopyright(), false, true);
		let fullClassNameInput = await FileFactory.PrettyInputBox("Class name", "Enter class name (e.g. SomeClass / MyNamespace::MyOtherNamespace::SomeClass)");
		if (fullClassNameInput === undefined) return;
		
		let fullClassName = String(fullClassNameInput);
		const reNameValidator = /(?:(?:(?:[A-Za-z_]\w*)+::).*)?(?:[A-Za-z_]\w*)+/g
		if (!reNameValidator.test(fullClassName)) {
			vscode.window.showErrorMessage("C++ class geerator: invalid characters in class name");
			return;
		}

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
		let templPick = await FileFactory.PrettyQuickPick(
			templates,
			{
				canPickMany: false,
				title: "Choose class template",
				placeHolder: "Template for class"
			}
		);
		if (typeof templPick !== 'string')
			return;
		let template = await gConfig.getTemplate(templPick);
		if (template === undefined) {
			vscode.window.showErrorMessage("C++ class geerator: template is undefined");
			return;
		}
		let isSingleFile = !Array.isArray(template.source);
		let sourcePath = path.path;
		if (sourcePath === "") return;

		let headerExt = template.header_extension === undefined ? ".h" : template.header_extension;
		let sourceExt = template.source_extension === undefined ? ".cpp" : template.source_extension;
		let singleHeaderExt = template.header_extension === undefined ? ".hpp" : template.header_extension;
		let headerFileTemplate = (template.header as Array<string>).join('\n');
		this.sourceName = `${filename}${sourceExt}`;

		// Create files
		if (!isSingleFile) {
			let sourceFileTemplate = (template.source as Array<string>).join('\n');
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
			let headerfile = this.processString(
				headerFileTemplate,
				true);
			FileFactory.ProcessFile(path.path, filename, singleHeaderExt, headerfile);
		}
		if (gConfig.isNeedConfigureCmake()) FileFactory.CmakeConfigure(path);
		vscode.window.showInformationMessage("C++ class generator: Done!");
	}
};

export function activate(context: vscode.ExtensionContext) {
	console.log('cpp-class-generator is now active!');

	let disposable = vscode.commands.registerCommand('cpp-class-generator.createClass', async (path: vscode.Uri) => { // Code
		let factory = new FileFactory;
		factory.CreateFile(path);
	});

	context.subscriptions.push(disposable, gConfig);
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log('cpp-class-generator deactivated');
}