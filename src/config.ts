import * as vscode from 'vscode';
import { ConfigTemplate, Template } from './template';

export class Config {
    private templates: Map<string, Template> = new Map();
    private configChangeDisposable: vscode.Disposable;
    private dateFormat = "DD.MM.YYYY";
    private userName: string | null = null;
    private copyright = [
        "//",
        "// Created by {userName} on {date} ",
        "//"
    ];
    private cmakeConfigure: boolean = false;

    constructor() {
        this.reload();
        this.configChangeDisposable = vscode.workspace.onDidChangeConfiguration(this.onChangeConfiguration, this);
    }

    private async onChangeConfiguration(e: vscode.ConfigurationChangeEvent): Promise<void> {
        if (e.affectsConfiguration('cpp-class-generator'))
            await this.reload();
    }

    dispose(): void {
        this.configChangeDisposable.dispose();
    }

    private async readConfig(): Promise<void> {
        const config = vscode.workspace.getConfiguration('cpp-class-generator');

        this.dateFormat = config.get('date-format', this.dateFormat);
        this.copyright = config.get<Array<string>>('project.copyright', this.copyright);
        this.userName = config.get('user.name', this.userName);
        this.cmakeConfigure = config.get('cmake.configure', this.cmakeConfigure);

        this.templates.clear();
        // Merge global and local configs
        await this.loadTemplates(vscode.ConfigurationTarget.Global)
        await this.loadTemplates(vscode.ConfigurationTarget.Workspace)
        await this.loadTemplates(vscode.ConfigurationTarget.WorkspaceFolder)

        // Add default templates
        if (this.templates.size == 0) {
            const singleHeader: Template = {
                header: ["{copyright}", "#pragma once", "", "{namespaceStart}", "{namespaceTab}class {className}{};", "{namespaceEnd}"]
            };
            this.templates.set("Single file", singleHeader);

            const separated: Template = {
                header: "Single file",
                source: ["{copyright}", "#include \"{headerFileName}\"", ""]
            };
            this.templates.set("Separated Header/Source files", separated);
        }
    }

    private async loadTemplates(scope: vscode.ConfigurationTarget): Promise<void> {
        let config = vscode.workspace.getConfiguration('cpp-class-generator');
        const getConfig = (name: string, defaultValue?: any) => {
            const values = config.inspect(name);
            if (values === undefined) return defaultValue;
            if (scope == vscode.ConfigurationTarget.Global)
                return values.globalValue || defaultValue;
            else if (scope == vscode.ConfigurationTarget.Workspace)
                return values.workspaceValue || defaultValue;
            else if (scope == vscode.ConfigurationTarget.WorkspaceFolder)
                return values.workspaceFolderValue || defaultValue;
        };
        const templates = getConfig('templates') as Object;
        if (templates === undefined || !templates.hasOwnProperty('length') || (templates as Array<ConfigTemplate>).length == 0) {
            // Backward compatible - load old templates
            let headerExtension = getConfig('templates.header-extension', ".h");
            let singleHeaderExtension = getConfig('templates.single-header-extension', ".hpp");
            let sourceExtension = getConfig('templates.source-extension', ".cpp");
            const singleHeader = getConfig('templates.header-only');
            let old_templates: Map<string, Template> = new Map();
            if (singleHeader !== null && singleHeader !== undefined) {
                if (Array.isArray(singleHeader)) {
                    const templ: Template = {
                        header: (singleHeader as Array<string>)
                    };
                    old_templates.set("Imported (single-header)", templ);
                } else {
                    let templates = new Map<string, Array<string>>(Object.entries(singleHeader as Object));
                    Array.from(templates.keys()).forEach(name => {
                        let header = templates.get(name);
                        if (header === null || header === undefined) return;
                        const templ: Template = {
                            header: header,
                            header_extension: singleHeaderExtension
                        };
                        old_templates.set(`${name} (single-header)`, templ);
                    })
                }
            }
            const header = getConfig('templates.header');
            if (header !== null && header !== undefined) {
                if (Array.isArray(header)) {
                    const source = getConfig('templates.source');
                    if (Array.isArray(source)) {
                        const templ: Template = {
                            header: (header as Array<string>),
                            source: (source as Array<string>)
                        };
                        old_templates.set("Imported", templ);
                    }
                } else {
                    let header_templates = new Map<string, Array<any>>(Object.entries(header as Object));
                    let source_templates = new Map<string, Array<any>>(Object.entries(getConfig('templates.source') as Object));
                    Array.from(header_templates.keys()).forEach(name => {
                        let header = header_templates.get(name);
                        if (header === null || header === undefined) return;
                        let source = source_templates.get(name);
                        if (source === null || source === undefined) return;
                        const templ: Template = {
                            header: header,
                            header_extension: headerExtension,
                            source: source,
                            source_extension: sourceExtension
                        };
                        old_templates.set(name, templ);
                    })
                }
            }

            // Move data-format to new name
            let dateFormat = getConfig('templates.date-format', "");
            if (dateFormat !== "") {
                this.dateFormat = dateFormat;
                await config.update('date-format', dateFormat, scope);
            }

            // Convert old configs to new format
            let arr: Array<ConfigTemplate> = [];
            for (let [key, value] of old_templates) {
                const isSingleHeader = value.source === null || value.source === undefined;
                if (isSingleHeader) {
                    const templ: ConfigTemplate = {
                        name: key,
                        header: value.header,
                        header_extension: singleHeaderExtension
                    };
                    arr.push(templ);
                } else {
                    const templ: ConfigTemplate = {
                        name: key,
                        header: value.header,
                        header_extension: headerExtension,
                        source: value.source,
                        source_extension: sourceExtension
                    };
                    arr.push(templ);
                }
                this.templates.set(key, value);
            }
            if (arr.length > 0)
                await config.update('templates', arr, scope);
        } else {
            // Load new templates
            (templates as Array<ConfigTemplate>).forEach(templ => {
                if (templ.name === null || templ.name === undefined || templ.name.length == 0) {
                    console.log("cpp-class-generator: skip template without a name");
                    return;
                }
                if (templ.header === null || templ.header === undefined) {
                    console.log(`cpp-class-generator: skip template ${templ.name} - header not set`);
                    return;
                }
                this.templates.set(templ.name, (templ as Template));
            });
        }
    }

    private async resolveReferences(remove?: string): Promise<void> {
        if (this.templates.size < 2) return;

        if (remove !== null && remove !== undefined)
            this.templates.delete(remove);

        for (let [key, value] of this.templates) {
            let modified = false;
            if (typeof value.header === 'string') {
                let rhs = this.templates.get(value.header);
                if (rhs === undefined) {
                    console.log(`cpp-class-generator: Template ${value.header} not defined`);
                    this.resolveReferences(key);
                    break;
                }
                value.header = rhs.header;
                modified = true;
            }
            if (typeof value.source === 'string') {
                let rhs = this.templates.get(value.source);
                if (rhs === undefined) {
                    console.log(`cpp-class-generator: Template ${value.source} not defined`);
                    this.resolveReferences(key);
                    break;
                }
                value.source = rhs.source;
                modified = true;
            }
            if (modified) {
                if (typeof value.header === 'string' || typeof value.source === 'string') {
                    console.log(`cpp-class-generator: Reference to reference not allowed - template ${key} skipped`);
                    this.resolveReferences(key);
                    break;
                }
                this.templates.set(key, value);
            }
        }
    }

    public async reload() {
        this.readConfig().then(() => {
            this.resolveReferences();
        });
    }

    public async getTemplate(name: string): Promise<Template | undefined> {
        return this.templates.get(name);
    }

    public async getAvailableNames(): Promise<Array<string> | undefined> {
        if (this.templates.size == 0) return undefined;
        return Array.from(this.templates.keys());
    }

    public getDateFormat(): string {
        return this.dateFormat;
    }

    public getUserName(): string {
        if (typeof this.userName === 'string')
            return this.userName;
        return "";
    }

    public getCopyright(): string {
        return this.copyright.join('\n');
    }

    public isNeedConfigureCmake(): boolean {
        return this.cmakeConfigure;
    }
}