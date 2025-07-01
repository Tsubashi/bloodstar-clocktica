/**
 * code related to save commands
 * @module Save
 */
import {show as inputDlg} from '../dlg/blood-string-dlg';
import { Edition } from '../model/edition';
import { showError, show as showMessage } from '../dlg/blood-message-dlg';
import Locks from '../lock';
import {spinner} from '../dlg/spinner-dlg';
import { setRecentFile } from '../recent-file';
import { updateSaveNameWarnings, validateSaveName } from '../validate';
import { imageUrlToDataUri } from '../blood-image';
import genericCmd, { GenericCmdOptions } from './generic-cmd';
import signIn from '../sign-in';
import { TimeoutError } from './cmd';
import { show as getConfirmation, YesNoOptions } from '../dlg/yes-no-dlg';
import { SITE_ROOT } from '../config';

type ExistsRequest = {
    saveName:string;
    token:string;
};
type ExistsResponse = boolean;
type SaveRequest = {
    clobber?:boolean;
    edition:unknown;
    saveName:string;
    token:string;
};
type SaveResponse = 'cancel' | 'clobber' | {success:true};
type SaveImgRequest = {
    token:string;
    saveName:string;
    id:string;
    isSource:boolean;
    image:string;
};
type SaveImgResponse = {success:true};

const MAX_SIMULTANEOUS_IMAGE_SAVES = 4;

/**
 * prompt for a name, then save with that name
 * Brings up the loading spinner during the operation
 * @param edition file to save
 * @returns promise resolving to whether the save was successful
 */
export async function saveAs(edition:Edition):Promise<boolean> {
    const name = await promptForName(edition.saveName.get());
    if (name === null) {return false;}

    if (!validateSaveName(name)) {
        await showMessage('Invalid File Name', `"${name}" is not a valid filename.`);
        return false;
    }

    const backupName = edition.saveName.get();

    // if it would clobber, get confirmation first
    if ((backupName!==name) && !await clobberPrompt(name)) {
        return false;
    }

    try {
        await edition.saveName.set(name);
        await edition.markDirty();
        // TODO: could probably do this much much faster as a server command to move rather than a regen and re-save
        await spinner('Copying Images', edition.regenIdsForNameChange());
        return await _save(edition, true);
    } catch (error: unknown) {
        if (error instanceof TimeoutError) {
            await showError('Error', `Timed out while trying to save as ${name}. Please check your internet connection and save again.`, error);
            return false;
        }
        await showError('Error', `Error encountered while trying to save as ${name}. Please check your internet connection and save again.`, error);
    }
    return false;
}

/**
 * show loading dialog while saving
 * @param edition file to save
 * @returns promise resolving to whether the save was successful
 */
export async function save(edition:Edition):Promise<boolean> {
    const saveName = edition.saveName.get();
    try {
        switch (saveName) {
            case '':
                return await saveAs(edition);
            default:
                return await _save(edition, true);
        }
    } catch (error: unknown) {
        if (error instanceof TimeoutError) {
            await showError('Error', `Timed out while trying to save ${saveName}. Please check your internet connection and save again.`, error);
            return false;
        }
        await showError('Error', `Error encountered while trying to save ${saveName}. Please check your internet connection and save again.`, error);
        return false;
    }
}

type Separated = {
    edition:unknown;
    logo?:string;
    sourceImages:Map<string, string>;
    finalImages:Map<string, string>;
};

/** separate the edition json and images for saving as separate files */
async function separateImages(username:string, edition:Edition):Promise<Separated> {
    const saveName = edition.saveName.get();
    const editionSerialized = await edition.serialize();
    const characters = editionSerialized.characterList as {id:string; unStyledImage?:string; styledImage?:string}[];
    const sourceImages = new Map<string, string>();
    const finalImages = new Map<string, string>();
    for (const character of characters) {
        const {id} = character;
        if (!id) {continue;}

        const unStyledImageStr = character.unStyledImage;
        if (unStyledImageStr?.startsWith('data:')) {
            character.unStyledImage = `${SITE_ROOT}/usersave/${username}/${saveName}/${id}.src.png`;
            sourceImages.set(id, unStyledImageStr);
        }

        const styledImageStr = character.styledImage;
        if (styledImageStr?.startsWith('data:')) {
            character.styledImage = `${SITE_ROOT}/usersave/${username}/${saveName}/${id}.png`;
            finalImages.set(id, styledImageStr);
        }
    }
    const meta = editionSerialized.meta as {logo?:string};
    const {logo} = meta;
    if (logo?.startsWith('data:')) {
        meta.logo = `${SITE_ROOT}/usersave/${username}/${saveName}/_meta.png`;
    }

    return {
        edition:editionSerialized,
        logo,
        sourceImages,
        finalImages
    };
}

/**
 * Save the file under the name saved in it
 * Brings up the loading spinner during the operation
 * @param edition file to save
 * @param clobber true if you want it to replace any file found with the same name
 * @returns promise resolving to whether the save was successful
 */
async function _save(edition:Edition, clobber:boolean):Promise<boolean> {
    const signInOptions = {
        title:'Sign In to Save',
        message:'You must first sign in if you wish to save.'
    };
    const sessionInfo = await signIn(signInOptions);
    if (!sessionInfo) {return false;}
    const editionSaveName = edition.saveName.get();

    // serialize the edition, but break images out into separate pieces to save
    const toSave = await separateImages(sessionInfo.username, edition);

    // save JSON
    if (!await _saveJson(editionSaveName, toSave.edition, clobber)) { return false; }

    const imgSavePromises:Promise<void>[] = [];
    const controller = new AbortController();

    for (const [id, imageString] of toSave.sourceImages) {
        if (!imageString.startsWith('data:')) {continue;}
        if (!edition.isCharacterSourceImageDirty(id)) {continue;}
        imgSavePromises.push(Locks.enqueue('saveImage', async ()=>{
            await _savePng(editionSaveName, id, imageString, true, controller);
            edition.unDirtySourceImage(id);
        }, MAX_SIMULTANEOUS_IMAGE_SAVES));
    }

    for (const [id, imageString] of toSave.finalImages) {
        if (!imageString.startsWith('data:')) {continue;}
        if (!edition.isCharacterFinalImageDirty(id)) {continue;}
        imgSavePromises.push(Locks.enqueue('saveImage', async ()=>{
            await _savePng(editionSaveName, id, imageString, false, controller);
            edition.unDirtyFinalImage(id);
        }, MAX_SIMULTANEOUS_IMAGE_SAVES));
    }

    if (toSave.logo && edition.isLogoDirty()) {
        const sourceUrl = new URL(toSave.logo, location.origin);
        const isDataUri = sourceUrl.protocol === 'data:';
        let {logo} = toSave;
        if (!isDataUri) {
            logo = await imageUrlToDataUri(toSave.logo);
        }
        if (logo.startsWith('data:')) {
            imgSavePromises.push(Locks.enqueue('saveImage', async ()=>{
                await _savePng(editionSaveName, '_meta', logo, false, controller);
                edition.unDirtyLogo();
            }, MAX_SIMULTANEOUS_IMAGE_SAVES));
        }
    }

    // await all those images
    try {
        await spinner(`Saving as ${editionSaveName}`, Promise.all(imgSavePromises));
    } catch (e:unknown) {
        // if any fail, cancel the others
        controller.abort();
        throw e;
    }

    // mark things as up to date
    await edition.markClean();

    // update recent file
    setRecentFile(editionSaveName, sessionInfo.email);
    return true;
}

/** helper for _save */
async function _saveJson(saveName:string, serializedEdition:unknown, clobber:boolean):Promise<boolean> {
    const saveCmdOptions:GenericCmdOptions<SaveRequest> = {
        command:'save',
        errorMessage:`Error encountered while trying to save ${saveName}`,
        request:sessionInfo=>({
            token: sessionInfo?.token ?? '',
            saveName: saveName,
            clobber,
            edition: serializedEdition
        }),
        signIn:{
            title:'Sign In to Save',
            message:'You must first sign in if you wish to save.'
        },
        spinnerMessage:'Saving edition data',
    };
    let response = await genericCmd<SaveRequest, SaveResponse>(saveCmdOptions);
    if (!('data' in response)) {return false;}
    if (response.data==='clobber') {
        // try again with confirmation dialog
        saveCmdOptions.confirmOptions = {
            message:`There is already a save file named ${saveName}. Would you like to replace it?`,
            noLabel:'No, Cancel Save',
            title:'Confirm Overwrite',
            yesLabel:`Yes, Replace ${saveName}`
        };
        saveCmdOptions.request = sessionInfo=>({
            token: sessionInfo?.token ?? '',
            saveName: saveName,
            clobber:true,
            edition: serializedEdition
        });
        response = await genericCmd<SaveRequest, SaveResponse>(saveCmdOptions);
        if (!('data' in response)) {return false;}
    }

    if (response.data==='cancel') {return false;}
    if (response.data==='clobber') {return false;}
    return response.data.success;
}

/**
 * Helper for _save.
 */
async function _savePng(editionSaveName:string, imageId:string, imageString:string, isSource:boolean, controller:AbortController):Promise<void> {
    try {
        const response = await genericCmd<SaveImgRequest, SaveImgResponse>({
            command: 'save-img',
            controller: controller,
            errorMessage: `Error occurred while saving ${imageId}.src.png`,
            request:sessionInfo=>({
                token: sessionInfo?.token ?? '',
                saveName: editionSaveName,
                id: imageId,
                isSource,
                image: imageString
            }),
            signIn:{
                title:'Sign In to Save',
                message:'You must first sign in if you wish to save.'
            },
            spinnerMessage:`Saving ${imageId}${isSource?'.src':''}.png`
        });
        if ('error' in response) {throw new Error(response.error);}
        if ('cancel' in response) {throw new Error(`cancel reason: ${response.cancel}`);}
    } catch (e:unknown) {
        if (e instanceof TimeoutError) {
            e.message = `Timed out while saving ${imageId}${isSource?'.src':''}.png`;
        }
        throw e;
    }
}

/**
 * prompt the user to enter a name to save as
 */
async function promptForName(defaultName:string):Promise<string|null> {
    return inputDlg(
        'Save',
        'Enter name to save as.',
        defaultName,
        {
            pattern:'[A-Za-z0-9\\-_]{1,25}',
            hint: 'Name should contain only letters, numbers, hyphens (-), and underscores (_)',
            validateFn: validateSaveName,
            warningsFn: (input:string, container:HTMLElement)=>{ updateSaveNameWarnings(input, container, 'Save name'); }
        });
}

/**
 * True if it either wouldn't clobber, or the user said it's ok to clobber
 */
async function clobberPrompt(saveName:string):Promise<boolean> {
    // TODO: I should handle exceptions in here.
    const existsCmdOptions:GenericCmdOptions<ExistsRequest> = {
        command:'exists',
        errorMessage:`Error encountered while trying to save ${saveName}`,
        request:sessionInfo=>({
            saveName: saveName,
            token: sessionInfo?.token ?? '',
        }),
        signIn:{
            title:'Sign In to Save',
            message:'You must first sign in if you wish to save.'
        },
        spinnerMessage:'Saving edition data',
    };
    const response = await genericCmd<ExistsRequest, ExistsResponse>(existsCmdOptions);
    if (!('data' in response)) {return false;}
    if (!response.data) {return true;}

    const confirmOptions:YesNoOptions = {
        message:`There is already a save file named ${saveName}. Would you like to replace it?`,
        noLabel:'No, Cancel Save',
        title:'Confirm Overwrite',
        yesLabel:`Yes, Replace ${saveName}`
    };
    return getConfirmation(confirmOptions);
}
