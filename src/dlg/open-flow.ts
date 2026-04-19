/**
 * Dialogs for opening a file
 * @module OpenFlow
 */
import {Edition} from '../model/edition';
import * as SdcDlg from '../dlg/blood-save-discard-cancel';
import { spinner } from './spinner-dlg';
import { showError } from './blood-message-dlg';
import { createElement, CreateElementsOptions } from '../util';
import { AriaDialog } from './aria-dlg';
import { setRecentFile } from '../recent-file';
import signIn from '../sign-in';
import {showBlockUser} from './block-flow';
import { SignInFlowOptions } from './sign-in-flow';
import genericCmd from '../commands/generic-cmd';

type LeaveRequest = {token:string; owner:string; saveName:string};
type LeaveResponse = true;
type ListRequest = {token:string; includeShared?:boolean};
type ListFilesResponse = {
    error?:string;
    files:string[];
    shared?:Record<string, string[]>;
};
export type ListFilesReturn = {
    yours: string[];
    shared?: Record<string, string[]>;
} | null;
export type OpenRequest = {
    saveName: string|[string, string];
    token: string;
    username: string;
};
export type OpenResponse = {data:Record<string, unknown>};

type ChooseFileOptions = {
    /** customize prompt title */
    title?:string;

    /** customize prompt message */
    message?:string;

    /** list shared files? */
    includeShared?:boolean;

    /** whether to label it as making a copy of shared files */
    copyWarning?:boolean;
};

/** dialog for choosing a file */
class ChooseFileDlg extends AriaDialog<string|[string, string]> {
    /** returns name of chosen file, or empty string */
    async open(options?:ChooseFileOptions):Promise<string|[string, string]> {
        const fileListDiv = createElement({t:'div', css:['openDlgList']});
        const body:CreateElementsOptions = [
            {t:'h1', txt:options?.title ?? 'Choose File'},
            {t:'p', txt:options?.message ?? 'Choose an existing file to open:'},
            fileListDiv
        ];

        const listFilesData = await listFiles(options?.includeShared ?? false);
        if (!listFilesData) {return '';}
        const {yours:yourFiles, shared:sharedFiles} = listFilesData;
        const owners = (options?.includeShared && sharedFiles) ? Object.keys(sharedFiles) : [];

        // list your files (perhaps with label)
        if (owners.length) {
            fileListDiv.appendChild(createElement({t:'p', txt:'Your files:'}));
        }
        if (yourFiles.length) {
            for (const name of yourFiles) {
                const button = createElement({t:'button', txt:name, events:{click:()=>{ this.close(name); }}});
                fileListDiv.appendChild(button);
            }
        } else {
            fileListDiv.appendChild(createElement({t:'p', txt:'No files found.', a:{role:'alert'}}));
        }

        // list shared files
        if (owners.length && sharedFiles) {
            const sharedLabel = options?.copyWarning ? 'Copy a file shared with you:' : 'Files shared with you:';
            fileListDiv.appendChild(createElement({t:'p', txt:sharedLabel}));
            const sharedList = createElement({t:'div', css:['openSharedList']});
            fileListDiv.appendChild(sharedList);
            for (const owner of owners) {
                const editions = sharedFiles[owner];
                for (const edition of editions) {
                    const label = `${owner} / ${edition}`;
                    const openButton = createElement({t:'button', txt:label, events:{click:()=>{ this.close([owner, edition]); }}});
                    const leaveButton = createElement({t:'button', txt:'Leave'});
                    const blockButton = createElement({t:'button', txt:'Block'});
                    leaveButton.addEventListener('click', async ()=>{
                        if (await showLeave(owner, edition)) {
                            // Row can be removed
                            openButton.remove();
                            leaveButton.remove();
                            blockButton.remove();
                        }
                    });
                    blockButton.addEventListener('click', async ()=>{
                        if (await showBlockUser(owner)) {
                            // Any number of rows could be wrong now. Bail on the whole popup.
                            this.close(null);
                        }
                    });
                    sharedList.appendChild(openButton);
                    sharedList.appendChild(leaveButton);
                    sharedList.appendChild(blockButton);
                }
            }
        }

        return await this.baseOpen(
            document.activeElement,
            'open',
            body,
            [{label:'Cancel'}]
        ) ?? '';
    }
}

/** share file chooser with the delete command */
export async function chooseFile(options?:ChooseFileOptions):Promise<string|[string, string]> {
    return new ChooseFileDlg().open(options);
}

/**
 * Get a list of openable files
 * Brings up the loading spinner during the operation
 */
async function listFiles(includeShared:boolean):Promise<ListFilesReturn> {
    const result = await genericCmd<ListRequest, ListFilesResponse>({
        command:'list',
        errorMessage:'Error encountered while retrieving file list',
        request:sessionInfo=>({
            includeShared,
            token:sessionInfo?.token??'',
        }),
        signIn: {title:'Sign In to Choose File', message:'You must first sign in to choose a file.'},
        spinnerMessage:'Retrieving file list'
    });
    if ('error' in result) {return null;}
    if ('cancel' in result) {return null;}

    const {data} = result;
    const ret:ListFilesReturn = {
        yours: data.files,
    };
    if (data.shared && Object.keys(data.shared).length) {
        ret.shared = data.shared;
    }
    return ret;
}

/**
 * Open a file by name (no save prompts!)
 * Brings up the loading spinner during the operation
 * @param edition Edition instance with which to open a file
 * @param file name of the file to open
 * @param signInOptions SignInFlowOptions
 * @returns promise that resolves to whether a file was successfully opened
 */
async function openNoPrompts(edition:Edition, file:string|[string, string], signInOptions?:SignInFlowOptions):Promise<boolean> {
    try {
        const data = await openEditionFile(file, signInOptions);
        if (!data) {return false;}
        const label = Array.isArray(file) ? file.join(' / ') : file;
        const saveName = Array.isArray(file) ? '' : file;
        const success = await spinner(`Opening edition file "${label}"`, edition.open(saveName, data));
        if (success) {
            const sessionInfo = await signIn();
            if (!sessionInfo) {return false;}
            setRecentFile(edition.saveName.get(), sessionInfo.email);
        }
        return success;
    } catch (error: unknown) {
        await showError('Error', `Error encountered while trying to open file ${name}`, error);
        return false;
    }
}

/**
 * Get file data by name (no save prompts!)
 * Brings up the loading spinner during the operation
 * @param file name of the file to open
 * @param signInOptions SignInFlowOptions
 * @returns promise that resolves to edition data or null
 */
export async function openEditionFile(file:string|[string, string], signInOptions?:SignInFlowOptions):Promise<Record<string, unknown>|null> {
    const signInOptionsSafe = signInOptions ?? {
        title: 'Sign In to Open',
        message: 'You must first sign in to open a file.'
    };
    const label = Array.isArray(file) ? file.join(' / ') : file;
    const result = await genericCmd<OpenRequest, OpenResponse>({
        command:'open',
        errorMessage:`Error encountered while trying to open file ${label}`,
        request:sessionInfo=>({
            saveName: file,
            token:sessionInfo?.token??'',
            username: sessionInfo?.username??''
        }),
        signIn:signInOptionsSafe,
        spinnerMessage:`Retrieving ${label}`
    });

    if ('error' in result) {return null;}
    if ('cancel' in result) {return null;}
    return result.data.data;
}

/**
 * Prompt for the file to open and open it, skipping the save prompt
 * @param edition Edition instance with which to open a file
 * @param name Optional already-chosen file
 * @param options optional ChooseFileOptions for the dialog
 * @returns whether a file was successfully opened
 */
async function openPromptNoSavePrompt(edition:Edition, options?:ChooseFileOptions):Promise<boolean> {
    const name = await new ChooseFileDlg().open(options);
    return openExistingNoSavePrompt(edition, name);
}
/**
 * Open chosen file, skipping the save prompt
 * @param edition Edition instance with which to open a file
 * @param name Optional already-chosen file
 * @param options optional ChooseFileOptions for the dialog
 * @returns whether a file was successfully opened
 */
async function openExistingNoSavePrompt(edition:Edition, name:string|[string, string]):Promise<boolean> {
    if (Array.isArray(name)) {
        const label = name.join(' / ');
        return spinner(`Opening shared file "${label}"`, openNoPrompts(edition, name));
    } else if (name) {
        return spinner(`Opening edition file "${name}"`, openNoPrompts(edition, name));
    }
    return Promise.resolve(false);
}

/**
 * Open an already-chosen file
 * @param edition Edition instance with which to open a file
 * @param name savename of the file to open
 * @returns whether a file was successfully opened
 */
export async function openExisting(edition:Edition, name:string):Promise<boolean> {
    if (await SdcDlg.savePromptIfDirty(edition)) {
        return openExistingNoSavePrompt(edition, name);
    }
    return false;
}

/**
 * Open a file
 * @param edition Edition instance with which to open a file
 * @param options optional ChooseFileOptions for the dialog
 * @returns whether a file was successfully opened
 */
export async function promptAndOpen(edition:Edition, options?:ChooseFileOptions):Promise<boolean> {
    if (await SdcDlg.savePromptIfDirty(edition)) {
        return openPromptNoSavePrompt(edition, options);
    }
    return false;
}

/**
 * Confirm, then leave a file's sharelist
 * @param owner username of the file's owner
 * @param saveName savename for the file
 * @returns promise that resolves to whether you left the file
 */
async function showLeave(owner:string, saveName:string):Promise<boolean> {
    const result = await genericCmd<LeaveRequest, LeaveResponse>({
        command:'leave',
        confirmOptions: {
            title:`Leave "${owner} / ${saveName}"`,
            message: `Are you sure you'd like to leave "${owner} / ${saveName}"? You will no longer be able to import from this file.`
        },
        errorMessage:'Error encountered while retrieving share list',
        request:sessionInfo=>({
            owner,
            saveName,
            token:sessionInfo?.token??'',
        }),
        signIn: {title:'Sign In to Leave', message:'You must first sign in to leave the file\'s sharelist.'},
        spinnerMessage:'Leaving share list'
    });

    if ('error' in result) {return false;}
    if ('cancel' in result) {return false;}
    return result.data;
}
