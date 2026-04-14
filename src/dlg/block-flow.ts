/**
* Manage Blocked Users dialog
* @module ManageBlockedDlg
*/
import { createElement, CreateElementsOptions } from '../util';
import { updateUsernameWarnings, validateUsername } from '../validate';
import {AriaDialog, showDialog} from './aria-dlg';
import {show as showMessage} from './blood-message-dlg';
import genericCmd from '../commands/generic-cmd';
import { SessionInfo } from '../iam';

type BlockRequest = {token:string; username:string};
type BlockResponse = true;

type GetBlockedRequest = {token:string};
type GetBlockedResponse = {users:string[]};

type UnblockRequest = {token:string; username:string};
type UnblockResponse = true;

class ManageBlockedDlg extends AriaDialog<void> {
    blockList:string[]|null = null;

    listDiv:HTMLDivElement|null = null;

    addButton:HTMLButtonElement|null = null;

    /** create the dialog */
    async open():Promise<void> {
        this.blockList = await getBlockList();
        if (!this.blockList) {return;}
        this.listDiv = createElement({t:'div', css:['shareDlgList']});
        this.addButton = createElement({t:'button', txt:'Block a User'});
        this.addButton.addEventListener('click', async ()=>{
            const username = await showBlockPrompt();
            if (username && await showBlockUser(username)) {
                this.blockList?.push(username);
                this.update();
            }
        });

        const body:CreateElementsOptions = [
            {t:'h1', txt:'Manage Blocked Users'},
            {t:'p', txt:'Currently blocked users:'},
            this.listDiv,
            {t:'div', css:['column'], children:[this.addButton]}
        ];

        this.update();

        await this.baseOpen(
            document.activeElement,
            'manage-blocked-dlg',
            body,
            [{label:"Done"}]
        );
    }

    /** add a row to the list */
    addRow(name:string):void {
        if (!this.listDiv) {return;}
        this.listDiv.appendChild(createElement({t:'span', txt:name}));
        this.listDiv.appendChild(createElement({t:'button', txt:'Unblock', events:{click:async ()=>{
            if (this.blockList && await showUnblockUser(name)) {
                const i = this.blockList.indexOf(name);
                if (i !== -1) {
                    this.blockList.splice(i, 1);
                    this.update();
                }
            }
        }}}));
    }

    /** update dialog after changes */
    update():void {
        if (!this.listDiv) {return;}
        if (!this.blockList) {return;}
        if (this.blockList.length === 0) {
            this.listDiv.innerText = 'No one';
        } else {
            this.listDiv.innerText = '';
            for (const name of this.blockList) {
                this.addRow(name);
            }
        }
    }
}

/**
 * Confirm, then block a user
 * @param username username of who to block
 * @returns promise that resolves to whether the user was blocked
 */
export async function showBlockUser(username:string):Promise<boolean> {
    const result = await genericCmd<BlockRequest, BlockResponse>({
        command: 'block',
        confirmOptions: {title:`Block ${username}`, message:`Are you sure you'd like to block ${username}? You will no longer be able to import files they share.`},
        errorMessage: `Error encountered while blocking`,
        request: (sessionInfo:SessionInfo|null)=>({
            token:sessionInfo?.token ?? '',
            username,
        }),
        signIn: {title:'Sign In to Block', message:'You must first sign in before blocking a user.'},
        spinnerMessage: `Blocking user "${username}"`
    });
    return ('data' in result);
}

/**
 * Get a list of users you have blocked
 * Brings up the loading spinner during the operation
 */
export async function getBlockList():Promise<string[]|null> {
    const result = await genericCmd<GetBlockedRequest, GetBlockedResponse>({
        command:'get-blocked',
        errorMessage: 'Error encountered while retrieving block list',
        request: si=>({token:si?.token ?? ''}),
        signIn:{message:'You must sign in to manage your block list.'},
        spinnerMessage: 'Retrieving block list'
    });
    if (!('data' in result)) {return null;}
    if (!Array.isArray(result.data.users)) { throw new Error('"get-blocked" command failed.'); }
    return result.data.users;
}

/**
 * Prompt for a name of a user to block
 * @returns Promise that resolves to the name to blockor the empty string if cancelled
 */
async function showBlockPrompt():Promise<string> {
    const usernameField = createElement({t:'input', a:{type:'text', required:'true', placeholder:'Username', autocomplete:'username'}, id:'blockPromptUsername'});
    const usernameWarnings = createElement({t:'div', css:['column'], a:{style:'color:red'}});
    const syncToButton = ()=>{
        const buttonElem = document.getElementById('blockUserButton');
        if (!(buttonElem instanceof HTMLButtonElement)) {return;}
        buttonElem.disabled = !usernameField.value;
    };
    const usernameWarn = ()=>{
        updateUsernameWarnings(usernameField.value, usernameWarnings, 'Username');
        syncToButton();
    };
    usernameField.addEventListener('change', usernameWarn);
    usernameField.addEventListener('input', usernameWarn);
    const blockUser = async ():Promise<string>=>{
        if (!validateUsername(usernameField.value)) {
            await showMessage('Block Error', 'Username not valid.');
            return '';
        }
        return usernameField.value;
    };
    const buttons = [
        {label:'Block', id:'blockUserButton', callback:blockUser, disabled:true},
        {label:'Cancel'}
    ];

    return await showDialog<string>(
        document.activeElement,
        'block-prompt',
        [
            {t:'h1', txt:'Block User'},
            {t:'div', css:['twoColumnGrid'], children:[
                {t:'label', a:{'for':'blockPromptUsername'}, txt:'Username'},
                usernameField,
            ]},
            usernameWarnings
        ],
        buttons
    ) ?? '';
}

/** show dialog for managing block list */
export async function showManageBlocked():Promise<void> {
    await new ManageBlockedDlg().open();
}

/**
 * Confirm, then unblock a user
 * @param username username of who to unblock
 * @returns promise that resolves to whether the user was unblocked
 */
export async function showUnblockUser(username:string):Promise<boolean> {
    const result = await genericCmd<UnblockRequest, UnblockResponse>({
        command: 'unblock',
        confirmOptions: {title:`Block ${username}`, message:`Are you sure you'd like to block ${username}? You will no longer be able to import files they share.`},
        errorMessage: `Error encountered while unblocking`,
        request: (sessionInfo:SessionInfo|null)=>({
            token:sessionInfo?.token ?? '',
            username,
        }),
        signIn: {title:'Sign In to Unblock', message:'You must first sign in before unblocking a user.'},
        spinnerMessage: `Unblocking user "${username}"`
    });
    return ('data' in result);
}
