/**
 * Code related to menu commands
 * @module Menu
 */
import * as bloodstar from "./bloodstar";
import {showError, show as showMessage } from "./dlg/blood-message-dlg";
import { Edition } from "./model/edition";
import { hookupClickEvents, showHideElement } from "./util";
import { importBlood } from './import/blood-file';
import { importJsonFromFile, importJsonFromUrl, } from './import/json';
import importOfficial from './import/official';
import importShared from './import/shared';
import publish from './commands/publish';
import {save, saveAs} from './commands/save';
import {chooseAndDeleteFile} from './commands/delete';
import {deleteAccount} from './dlg/delete-account-flow';
import * as SdcDlg from './dlg/blood-save-discard-cancel';
import {signIn, signOut} from './sign-in';
import { setRecentFile } from "./recent-file";
import { promptAndOpen } from "./dlg/open-flow";
import { SessionInfo } from "./iam";
import { newEdition } from './commands/new';
import showResetPasswordFlow from './dlg/reset-password-flow';
import showSharing from './dlg/sharing-dlg';
import {showManageBlocked} from './dlg/block-flow';
import { closeAllCurtains } from "./curtain";
import showSignUpFlow from './dlg/sign-up-flow';

/** add a new character to the custom edition */
async function addCharacterClicked(edition:Edition):Promise<boolean> {
    const newCharacter = await edition.addNewCharacter();

    // scroll down to it if necessary
    const list = document.getElementById('characterList');
    const newItem = list?.lastElementChild;
    newItem?.scrollIntoView();

    // select it
    await bloodstar.selectedCharacter.set(newCharacter);

    return true;
}

/** user chose to change their password */
async function changePasswordClicked():Promise<boolean> {
    return Boolean(await showResetPasswordFlow());
}

/** menu item for delete clicked */
export async function deleteFileClicked(edition:Edition):Promise<boolean> {
    const deleted = await chooseAndDeleteFile();
    if (!deleted) {return false;}

    // if you deleted the current edition, you must mark all its images as dirty!
    if (deleted === edition.saveName.get()) {
        await edition.markDirty();
    }

    return true;
}

/** user chose to import official character(s) */
async function importOfficialClicked(edition:Edition):Promise<boolean> {
    try {
        return await importOfficial(edition);
    } catch (error: unknown) {
        await showError('Error', 'Something went wrong when trying to clone official character', error);
        throw error;
    }
}

/** user chose to import from a shared Bloodstar file */
async function importSharedClicked(edition:Edition):Promise<boolean> {
    try {
        return await importShared(edition);
    } catch (error: unknown) {
        await showError('Error', 'Something went wrong when trying to import from shared Bloodstar save', error);
        throw error;
    }
}

/** hook up menu commands to html elements */
export default function init(edition:Edition):void {
    const mapping:[string, (e:Edition)=>Promise<boolean>][] = [
        ['signInBtn', signInClicked],
        ['signUpBtn', signUpClicked],
        ['signOutBtn', signOutClicked],
        ['changePasswordBtn', changePasswordClicked],
        ['deleteAccountBtn', deleteAccount],
        ['addCharacterButton', addCharacterClicked],
        ['newFileButton', newFileClicked],
        ['openFileButton', async (ed:Edition)=>promptAndOpen(ed, {includeShared:true, copyWarning:true})],
        ['deleteFileButton', deleteFileClicked],
        ['saveFileButton', save],
        ['saveFileAsButton', saveFileAsClicked],
        ['jsonFromUrlButton', importJsonFromUrl],
        ['jsonFromFileButton', importJsonFromFile],
        ['importBloodButton', importBlood],
        ['importOfficialButton', importOfficialClicked],
        ['saveAndPublishButton', saveAndPublishClicked],
        ['sharingButton', sharingButtonClicked],
        ['importSharedButton', importSharedClicked],
        ['blockedUsersButton', blockedUsersClicked]
    ];
    const translatedMapping:[string, (e:Event)=>void][] = mapping.map(x=>{
        const [name, f] = x;
        return [name, async ()=>f(edition)];
    });
    hookupClickEvents(translatedMapping);

    // on mobile, menu options should also close the curtain
    if (bloodstar.isMobile()) {
        const curtainCloseMapping:[string, (e:Event)=>void][] = mapping.map(x=>{
            const [name] = x;
            return [name, closeAllCurtains];
        });
        hookupClickEvents(curtainCloseMapping);
    }
}

/**
 * user chose to open a new file
 */
async function newFileClicked(edition:Edition):Promise<boolean> {
    try {
        await newEdition(edition);
    } catch (error: unknown) {
        await showError('Error', 'Something went wrong when creating new file', error);
    }
    return true;
}

/** user chose to save and publish */
async function saveAndPublishClicked(edition:Edition):Promise<boolean> {
    // needs to be saved first if dirty OR never-been-saved
    const saveNeeded = edition.dirty.get() || (edition.saveName.get() === edition.saveName.getDefault());

    if (!saveNeeded || await save(edition)) {
        await publish(edition);
    }
    return false;
}

/**
 * user chose to save the current file under a new name
 */
export async function saveFileAsClicked(edition:Edition):Promise<boolean> {
    const sessionInfo = await signIn({
        title:'Sign In to Save',
        message:'You must be signed in to save.'
    });
    if (!sessionInfo) {return false;}
    if (!await saveAs(edition)) {return false;}
    setRecentFile(edition.saveName.get(), sessionInfo.email);
    return true;
}

/** clicked the sharing button */
async function sharingButtonClicked(edition:Edition):Promise<boolean> {
    const saveName = edition.saveName.get();
    if (!saveName) {
        await showMessage('No Savename', 'You must save this file before you can share it.');
        return false;
    }
    await showSharing(saveName);
    return true;
}

/** clicked the Manage Blocked Users button */
async function blockedUsersClicked():Promise<boolean> {
    await showManageBlocked();
    return true;
}

/** sign in */
async function signInClicked():Promise<boolean> {
    await signIn();
    return true;
}

/** sign up */
async function signUpClicked():Promise<boolean> {
    await showSignUpFlow();
    await signIn();
    return true;
}

/** forget session info */
async function signOutClicked(edition:Edition):Promise<boolean> {
    if (!await SdcDlg.savePromptIfDirty(edition)) {return false;}
    signOut();
    await edition.reset();
    await signIn({cancelLabel:'Continue as Guest'});
    return true;
}

/** show who is signed in and a sign out button */
export function updateUserDisplay(session:SessionInfo|null):void {
    for (const id of ['signedInLabel', 'signOutBtn', 'changePasswordBtn', 'deleteAccountBtn']) {
        const element = document.getElementById(id);
        if (element) {
            showHideElement(element, Boolean(session));
        }
    }
    for (const id of ['signedOutLabel', 'signInBtn', 'signUpBtn']) {
        const element = document.getElementById(id);
        if (element) {
            showHideElement(element, !session);
        }
    }

    const username = document.getElementById('userName');
    if (!(username instanceof HTMLSpanElement)) {return;}
    username.innerText = session ? session.username : '';
}