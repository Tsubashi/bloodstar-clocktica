/**
* Sharing dialog
* @module SharingDlg
*/
import genericCmd from '../commands/generic-cmd';
import { createElement, CreateElementsOptions } from '../util';
import { updateUsernameWarnings, validateUsername } from '../validate';
import {AriaDialog, ButtonCfg, showDialog} from './aria-dlg';
import {showError, show as showMessage} from './blood-message-dlg';

type GetSharedRequest = {token:string; saveName:string};
type GetSharedResponse = {users:string[]};

type ShareRequest = GetSharedRequest & {user:string};
type ShareResponse = true;

type UnshareRequest = GetSharedRequest & {user:string};
type UnshareResponse = true;

class SharingDlg extends AriaDialog<void> {
    shareList:string[] = [];

    editionName:string;

    listDiv:HTMLDivElement|null = null;

    addUserButton:HTMLButtonElement|null = null;

    constructor(editionName:string) {
        super();
        this.editionName = editionName;
    }

    /** create the dialog */
    async open(editionName:string):Promise<void> {
        this.editionName = editionName;
        if (!this.editionName) {return;}
        const shareList = await this.getShareList();
        if (shareList === null) {return;}
        this.shareList = shareList;
        this.listDiv = createElement({t:'div', css:['shareDlgList']});
        this.addUserButton = createElement({t:'button', txt:'Add User'});
        this.addUserButton.addEventListener('click', async ()=>this.showShareWithUser());

        const body:CreateElementsOptions = [
            {t:'h1', txt:'Sharing settings'},
            {
                t:'p',
                txt:'Users you are share this edition with will be able to open a copy and will be able to import characters from it.',
                a:{style:"max-width:300px"}
            },
            { t:'p', txt:`You are currently sharing "${editionName}" with:` },
            this.listDiv,
            {t:'div', css:['column'], children:[this.addUserButton]}
        ];

        this.updateSharingDlg();

        await this.baseOpen(
            document.activeElement,
            'sharing-dlg',
            body,
            [{label:"Done"}]
        );
    }

    /**
     * Get a list of users with whom you are sharing
     * Brings up the loading spinner during the operation
     */
    async getShareList():Promise<string[] | null> {
        const result = await genericCmd<GetSharedRequest, GetSharedResponse>({
            command:'get-shared',
            errorMessage:'Error encountered while retrieving share list',
            request:sessionInfo=>({
                token:sessionInfo?.token??'',
                saveName:this.editionName
            }),
            signIn: {message:'You must sign in to change sharing settings.'},
            spinnerMessage:'Retrieving share list'
        });
        if ('data' in result) {return result.data.users;}
        return null;
    }

    /** remove a user */
    async removeUser(user:string):Promise<boolean> {
        const response = await genericCmd<UnshareRequest, UnshareResponse>({
            command:'unshare',
            confirmOptions: {title:'Unshare with user?', message:`Are you sure you'd like to stop sharing with user "${user}"?`},
            errorMessage:'Error encountered while unsharing',
            request:sessionInfo=>({
                token:sessionInfo?.token??'',
                saveName:this.editionName,
                user
            }),
            signIn: {title:'Sign In', message:'You must sign in to change sharing settings.'},
            spinnerMessage:`Unsharing ${this.editionName}`
        });

        if ('error' in response) { return false;}
        if ('cancel' in response) { return false;}

        const i = this.shareList.indexOf(user);
        if (i !== -1) {
            this.shareList.splice(i, 1);
        }
        this.updateSharingDlg();

        return response.data;
    }

    /** do the command to share with the specified user */
    async shareWithUser(user:string):Promise<boolean> {
        const response = await genericCmd<ShareRequest, ShareResponse>({
            command:'share',
            errorMessage:`Error encountered while sharing`,
            request:sessionInfo=>({
                token:sessionInfo?.token??'',
                saveName:this.editionName,
                user
            }),
            signIn: {title:'Sign In', message:'You must sign in to change sharing settings.'},
            spinnerMessage:'Retrieving share list'
        });

        if ('error' in response) { return false;}
        if ('cancel' in response) { return false;}

        this.shareList.push(user);
        this.updateSharingDlg();
        return response.data;
    }

    /** bring up subdialog for sharing with a specific person */
    async showShareWithUser():Promise<boolean> {
        const usernameField = createElement({t:'input', a:{type:'text', required:'true', placeholder:'Username', autocomplete:'username'}, id:'shareWithUserDlgUsername'});
        const usernameWarnings = createElement({t:'div', css:['column'], a:{style:'color:red'}});
        const syncToButton = ()=>{
            const buttonElem = document.getElementById('shareWithUserButton');
            if (!(buttonElem instanceof HTMLButtonElement)) {return;}
            buttonElem.disabled = !usernameField.value;
        };
        const usernameWarn = ()=>{
            updateUsernameWarnings(usernameField.value, usernameWarnings, 'Username');
            syncToButton();
        };
        usernameField.addEventListener('change', usernameWarn);
        usernameField.addEventListener('input', usernameWarn);
        const shareWithUser = async ():Promise<boolean>=>{
            if (!validateUsername(usernameField.value)) {
                await showMessage('Share Error', 'Username not valid.');
                return Promise.resolve(false);
            }
            try {
                return await this.shareWithUser(usernameField.value);
            } catch (error: unknown) {
                await showError('Share Error', 'Something went wrong while sharing.', error);
                return Promise.resolve(false);
            }
        };
        const buttons:ButtonCfg<boolean>[] = [
            {label:'Share', id:'shareWithUserButton', callback:shareWithUser, disabled:true},
            {label:'Cancel'}
        ];

        const result = await showDialog<boolean>(
            document.activeElement,
            'share-with-user',
            [
                {t:'h1', txt:'Share with User'},
                {t:'div', css:['twoColumnGrid'], children:[
                    {t:'label', a:{'for':'shareWithUserDlgUsername'}, txt:'Username'},
                    usernameField,
                ]},
                usernameWarnings
            ],
            buttons
        );
        return result ?? false;
    }

    /** update dialog after changes */
    updateSharingDlg():void {
        if (!this.listDiv) {return;}
        if (!this.addUserButton) {return;}
        if (this.shareList.length === 0) {
            this.listDiv.innerText = 'No one';
            this.addUserButton.disabled = false;
        } else {
            this.listDiv.innerText = '';
            for (const name of this.shareList) {
                this.listDiv.appendChild(createElement({t:'span', txt:name}));
                this.listDiv.appendChild(createElement({t:'button', txt:'Remove', events:{click:async ()=>{
                    await this.removeUser(name);
                }}}));
            }
            this.addUserButton.disabled = false;
        }
    }
}

/** show sharing dialog */
export default async function show(editionSaveName:string):Promise<void> {
    if (!editionSaveName) {return;}
    await new SharingDlg(editionSaveName).open(editionSaveName);
}
