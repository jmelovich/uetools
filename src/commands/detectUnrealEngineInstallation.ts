import * as vscode from 'vscode';
import { UnrealEngineProject } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { Context } from '../helpers/context';

export const detectUnrealEngineInstallation = (): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
        (async () => {

            // check for project in the context
            const project = Context.get('project') as UnrealEngineProject;

            if (!project) {
                reject(new Error('No project found'));
                return false;
            }

            // check operating system
            const os = process.platform;

            // get unreal engine version override
            const unrealEngineVersionOverride = vscode.workspace.getConfiguration().get('uetools.unrealEngineVersionOverride') as string;

            let engineFolder;
            let unrealEngineInstallationSearchPath = vscode.workspace.getConfiguration().get('uetools.unrealEngineInstallationSearchPath') as string;

            if(unrealEngineVersionOverride) {
                let overridePath: string;
                
                // Check if override is already a full path
                if(path.isAbsolute(unrealEngineVersionOverride)) {
                    overridePath = unrealEngineVersionOverride;
                } else {
                    // Combine with search path first, get default search path if needed
                    if(!unrealEngineInstallationSearchPath) {
                        if (os === 'win32') {
                            unrealEngineInstallationSearchPath = 'C:\\Program Files\\Epic Games';
                        } else if (os === 'darwin') {
                            unrealEngineInstallationSearchPath = '/Users/Shared/Epic Games';
                        } else if(os === 'linux') {
                            unrealEngineInstallationSearchPath = '/opt/Epic Games';
                        } else {
                            reject(new Error('Unreal Engine installation not found. Please set the path in settings.'));
                            return false;
                        }
                    }
                    overridePath = path.join(unrealEngineInstallationSearchPath, unrealEngineVersionOverride);
                }
                
                // check if the folder exists
                if(fs.existsSync(overridePath)) {
                    // set the engine folder to the override path
                    engineFolder = path.basename(overridePath);
                    // set the search path to the parent directory of the override path
                    unrealEngineInstallationSearchPath = path.dirname(overridePath);
                } else {
                    reject(new Error('Unreal Engine installation not found at override path. Please set the path in settings.'));
                    return false;
                }
            }

            // get unreal engine installation seach path and check if the version associated with project is installed
            if(!unrealEngineInstallationSearchPath) {
                // try default installation path by operating system
                if (os === 'win32') {
                    unrealEngineInstallationSearchPath = 'C:\\Program Files\\Epic Games';
                } else if (os === 'darwin') {
                    unrealEngineInstallationSearchPath = '/Users/Shared/Epic Games';
                } else if(os === 'linux') {
                    unrealEngineInstallationSearchPath = '/opt/Epic Games';
                } else {
                    reject(new Error('Unreal Engine installation not found. Please set the path in settings.'));
                    return false;
                }
                if(fs.existsSync(unrealEngineInstallationSearchPath)) {
                    vscode.workspace.getConfiguration().update('uetools.unrealEngineInstallationSearchPath', unrealEngineInstallationSearchPath, vscode.ConfigurationTarget.Global);
                } else {
                    reject(new Error('Unreal Engine installation not found. Please set the path in settings.'));
                    return false;
                }
            }

            const folders = fs.readdirSync(unrealEngineInstallationSearchPath);

            if(!engineFolder) {
                engineFolder = folders.find(folder => folder.includes(`${project.EngineAssociation}`));
                if(!engineFolder) {
                    reject(new Error(`Unreal Engine ${project.EngineAssociation} not found in ${unrealEngineInstallationSearchPath}`));
                    return false;
                }
            }

            // // ask user to select a unreal engine installation from list with tip
            // const engineFolder = await vscode.window.showQuickPick(folders, { placeHolder: 'Select Unreal Engine Installation' });
            // if (!engineFolder) {
            //     reject(new Error('No Unreal Engine installation selected'));
            //     return;
            // }

            Context.set("unrealEngineInstallation", path.join(unrealEngineInstallationSearchPath, engineFolder));
            
            // set UnrealBuildTool, UnrealEditor and Mono path based on Unreal version.
            // get engine version as number
            const engineVersion = parseInt(project.EngineAssociation.replace('UE_', ''));


            // get the three override paths 
            const unrealBuildToolPathOverride = vscode.workspace.getConfiguration().get('uetools.unrealBuildToolPathOverride') as string;
            const unrealEditorPathOverride = vscode.workspace.getConfiguration().get('uetools.unrealEditorPathOverride') as string;
            const unrealRuntimePathOverride = vscode.workspace.getConfiguration().get('uetools.unrealRuntimePathOverride') as string;   

            // Track which overrides were successfully set
            let unrealBuildToolPathSet = false;
            let unrealEditorPathSet = false;
            let runtimePathSet = false;

            // check if each override path exists (try first as relative path (starting with Engine/) then as absolute path)
            // if it does not exist, fall back to the default path
            // if it does exist, we will use it instead
            if(unrealBuildToolPathOverride) {
                // Try as relative path first
                const relativeOverridePath = path.join(Context.get('unrealEngineInstallation') as string, unrealBuildToolPathOverride);
                if(fs.existsSync(relativeOverridePath)) {
                    Context.set("unrealBuildToolPath", relativeOverridePath);
                    unrealBuildToolPathSet = true;
                } else if(fs.existsSync(unrealBuildToolPathOverride)) {
                    // Try as absolute path
                    Context.set("unrealBuildToolPath", unrealBuildToolPathOverride);
                    unrealBuildToolPathSet = true;
                }
            }
            if(unrealEditorPathOverride) {
                // Try as relative path first
                const relativeOverridePath = path.join(Context.get('unrealEngineInstallation') as string, unrealEditorPathOverride);
                if(fs.existsSync(relativeOverridePath)) {
                    Context.set("unrealEditorPath", relativeOverridePath);
                    unrealEditorPathSet = true;
                } else if(fs.existsSync(unrealEditorPathOverride)) {
                    // Try as absolute path
                    Context.set("unrealEditorPath", unrealEditorPathOverride);
                    unrealEditorPathSet = true;
                }
            }   
            if(unrealRuntimePathOverride) {
                // Try as relative path first
                const relativeOverridePath = path.join(Context.get('unrealEngineInstallation') as string, unrealRuntimePathOverride);
                if(fs.existsSync(relativeOverridePath)) {
                    Context.set("runtimePath", relativeOverridePath);
                    runtimePathSet = true;
                } else if(fs.existsSync(unrealRuntimePathOverride)) {
                    // Try as absolute path
                    Context.set("runtimePath", unrealRuntimePathOverride);
                    runtimePathSet = true;
                }
            }

            // Set default paths only for tools that don't have valid overrides
            // special case to check for my particular case
            if(project.EngineAssociation.toLowerCase().includes('adks') || project.EngineAssociation.toLowerCase().includes('oculus')) {
                if(os === 'win32') {
                    if(!unrealBuildToolPathSet) {
                        Context.set("unrealBuildToolPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\DotNET\\UnrealBuildTool\\UnrealBuildTool.dll'));
                    }
                    if(!unrealEditorPathSet) {
                        Context.set("unrealEditorPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\Win64\\UnrealEditor.exe'));
                    }
                    if(!runtimePathSet) {
                        Context.set("runtimePath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\ThirdParty\\DotNet\\6.0.302\\windows\\dotnet.exe'));
                    }
                }else{
                    reject(new Error(`Only Windows is supported for Unreal Engine ${project.EngineAssociation}.`));
                    return false;
                }
            }else if(engineVersion === 4) {
                if(os === 'win32') {
                    if(!unrealBuildToolPathSet) {
                        Context.set("unrealBuildToolPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\DotNET\\UnrealBuildTool.exe'));
                    }
                    if(!unrealEditorPathSet) {
                        Context.set("unrealEditorPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\Win64\\UE4Editor.exe'));
                    }
                    if(!runtimePathSet) {
                        Context.set("runtimePath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\ThirdParty\\DotNet\\Windows\\dotnet.exe'));
                    }
                } else if(os === 'darwin') {
                    if(!unrealBuildToolPathSet) {
                        Context.set("unrealBuildToolPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/DotNET/UnrealBuildTool.exe'));
                    }
                    if(!unrealEditorPathSet) {
                        Context.set("unrealEditorPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/Mac/UE4Editor.app/Contents/MacOS/UnrealEditor'));
                    }
                    if(!runtimePathSet) {
                        Context.set("runtimePath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/ThirdParty/Mono/Mac/bin/mono'));
                    }
                } else if(os === 'linux') {
                    if(!unrealBuildToolPathSet) {
                        Context.set("unrealBuildToolPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/DotNET/UnrealBuildTool.exe'));
                    }
                    if(!unrealEditorPathSet) {
                        Context.set("unrealEditorPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/Linux/UE4Editor'));
                    }
                    if(!runtimePathSet) {
                        Context.set("runtimePath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/ThirdParty/Mono/Linux/bin/mono'));
                    }
                } else {
                    reject(new Error(`Unsupported operating system: ${os}`));
                    return false;
                }
            } else if(engineVersion === 5) {
                if(os === 'win32') {
                    if(!unrealBuildToolPathSet) {
                        Context.set("unrealBuildToolPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\DotNET\\UnrealBuildTool\\UnrealBuildTool.dll'));
                    }
                    if(!unrealEditorPathSet) {
                        Context.set("unrealEditorPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\Win64\\UnrealEditor.exe'));
                    }
                    if(!runtimePathSet) {
                        Context.set("runtimePath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine\\Binaries\\ThirdParty\\DotNet\\Windows\\dotnet.exe'));
                    }
                } else if(os === 'darwin') {
                    if(!unrealBuildToolPathSet) {
                        Context.set("unrealBuildToolPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.dll'));
                    }
                    if(!unrealEditorPathSet) {
                        Context.set("unrealEditorPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor'));
                    }
                    if(!runtimePathSet) {
                        Context.set("runtimePath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/ThirdParty/DotNet/Mac/dotnet'));
                    }
                } else if(os === 'linux') {
                    if(!unrealBuildToolPathSet) {
                        Context.set("unrealBuildToolPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/DotNET/UnrealBuildTool/UnrealBuildTool.dll'));
                    }
                    if(!unrealEditorPathSet) {
                        Context.set("unrealEditorPath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/Linux/UnrealEditor'));
                    }
                    if(!runtimePathSet) {
                        Context.set("runtimePath", path.join(Context.get('unrealEngineInstallation') as string, 'Engine/Binaries/ThirdParty/Mono/Linux/bin/mono'));
                    }
                } else {
                    reject(new Error(`Unsupported operating system: ${os}`));
                    return false;
                }
            } else {
                reject(new Error(`Unreal Engine ${project.EngineAssociation} not supported`));
                return false;
            }

            // Notify user the selected unreal engine installation
            vscode.window.showInformationMessage(`Unreal Engine installation ${engineFolder} selected.`);
            console.log(`Unreal Engine installation selected.`);
            resolve(true);
            return true;
        })();
    });
};