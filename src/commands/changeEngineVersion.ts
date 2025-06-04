import * as vscode from 'vscode';
import { UnrealEngineProject } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import { Context } from '../helpers/context';

export const changeEngineVersion = (): Promise<boolean> => {
    return new Promise<boolean>((resolve, reject) => {
        (async () => {
            // check operating system
            const os = process.platform;

            // get unreal engine version override
            const unrealEngineVersionOverride = vscode.workspace.getConfiguration().get('uetools.unrealEngineVersionOverride') as string;

            let unrealEngineInstallationSearchPath = vscode.workspace.getConfiguration().get('uetools.unrealEngineInstallationSearchPath') as string;

            let engineFolder;
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
                    // set the unreal engine installation search path to the override path
                    engineFolder = overridePath;
                } else {
                    reject(new Error('Unreal Engine installation not found at override path. Please set the path in settings.'));
                    return false;
                }
            } else if(!unrealEngineInstallationSearchPath) { // get unreal engine installation seach path and check if the version associated with project is installed
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
            if(!engineFolder) {
                const folders = fs.readdirSync(unrealEngineInstallationSearchPath).filter(folder => folder.includes('UE_'));

                // ask user to select a unreal engine installation from list with tip
                engineFolder = await vscode.window.showQuickPick(folders, { placeHolder: 'Select Unreal Engine Installation' });
                if (!engineFolder) {
                    reject(new Error('No Unreal Engine installation selected'));
                    return;
                }
            }
            // Check if the workspaces contains a any file with the extension .uproject
            const workspaceFolders = vscode.workspace.workspaceFolders;
            
            if (workspaceFolders) {
                for (const folder of workspaceFolders) {
                    const files = fs.readdirSync(folder.uri.fsPath);
                    for (const file of files) {
                        if (file.endsWith('.uproject')) {
                            // parse the file and cast it as UnrealEngineProject
                            const project = JSON.parse(fs.readFileSync(`${folder.uri.fsPath}/${file}`, 'utf8'));

                            // change the engine association
                            project.EngineAssociation = engineFolder;

                            // write the file back
                            fs.writeFileSync(`${folder.uri.fsPath}/${file}`, JSON.stringify(project));

                            resolve(true);
                            return true;
                        }
                    }
                }
            }
            reject(new Error('No Unreal Engine project found'));
            return false;
        })();
    });
};