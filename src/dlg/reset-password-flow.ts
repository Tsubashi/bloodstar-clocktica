/**
 * dialogs for forgotten password
 * @module ResetPasswordFlow
 */
import { createElement, CreateElementsOptions } from "../util";
import {AriaDialog, showDialog} from './aria-dlg';
import {resetPassword, sendPasswordResetCode, SessionInfo} from '../iam';
import { updatePasswordWarnings, validatePassword } from "../validate";
import { showError } from "./blood-message-dlg";

type ResetPasswordData = {
    code:string;
    username:string;
    password:string;
};

class ConfirmAndChoosePasswordDlg extends AriaDialog<ResetPasswordData|null> {
    async open(username:string, doWarning:boolean):Promise<ResetPasswordData|null> {
        const codeField = createElement({
            t:'input',
            a:{type:'text', minlength:'6', maxlength:'6', autocomplete:'off', required:'', pattern:'[0-9]{6}', title:'six-digit code from your email'},
            id:'codeFromEmail'
        });
        const passwordField = createElement({t:'input', a:{type:'password', required:'true', placeholder:'New Password', autocomplete:'new-password'}, 'id':'passwordInput'});
        const passwordWarnings = createElement({t:'div', css:['column'], a:{style:'color:red;grid-column-start:span 2'}});
        const confirmField = createElement({
            t:'input',
            a:{type:'password', required:'true', placeholder:'Confirm Password', autocomplete:'new-password'},
            'id':'resetPasswordConfirm'
        });

        const body:CreateElementsOptions = [{t:'h1', txt:'Choose new password'}];
        if (doWarning) {
            body.push({
                t:'p',
                a:{style:'color:red;max-width:400px'},
                txt:'You must enter the correct confirmation code to reset your password. Please check your email for the six-digit code.'
            });
        }
        body.splice(body.length, 0, ...[
            {
                t:'p',
                a:{style:'max-width:400px'},
                txt:`We have sent an email to the address on file for "${username}" containing a 6-digit code. \
                Please enter the code below, enter new password, then click the button below to continue.`
            },
            {t:'div', css:['twoColumnGrid'], children:[
                {t:'label', a:{for:'codeFromEmail', title:'six-digit code from your email'}, txt:'Code from email'},
                codeField,
                {t:'label', a:{'for':'resetPassword'}, txt:'Password'},
                passwordField,
                {t:'label', a:{'for':'resetPasswordConfirm'}, txt:'Confirm Password'},
                confirmField,
                passwordWarnings,
            ]},
            {t:'div', css:['dialogBtnGroup'], children:[
                {t:'button', id:'setPasswordBtn', txt:'Set password', a:{disabled:true}, events:{click:()=>{
                    this.close({
                        code:codeField.value,
                        username,
                        password:passwordField.value
                    });
                }}},
                {t:'button', txt:'Cancel', events:{click:()=>{ this.close(); }}}
            ]},
            {t:'p', txt:"Didn't receive a code? ", a:{style:'align-self:center;'}, children:[
                {t:'a', a:{href:'#'}, txt:'Send a new one', events:{click:async ()=>sendPasswordResetCode(username)}}
            ]}
        ] as CreateElementsOptions);

        const syncButton = ()=>{
            const inputElement = this.querySelector('#codeFromEmail');
            if (!(inputElement instanceof HTMLInputElement)) {return;}
            const buttonElement = this.querySelector('#setPasswordBtn');
            if (!(buttonElement instanceof HTMLButtonElement)) {return;}
            const codeValue = parseInt(inputElement.value, 10);
            buttonElement.disabled = isNaN(codeValue) || !(validatePassword(passwordField.value) && (passwordField.value === confirmField.value));
        };
        const passwordWarn = ()=>{
            updatePasswordWarnings(passwordField.value, confirmField.value, passwordWarnings);
            syncButton();
        };
        codeField.addEventListener('change', syncButton);
        codeField.addEventListener('input', syncButton);
        passwordField.addEventListener('change', passwordWarn);
        passwordField.addEventListener('input', passwordWarn);
        confirmField.addEventListener('change', passwordWarn);
        confirmField.addEventListener('input', passwordWarn);

        return this.baseOpen(null, 'resetPassword', body, []);
    }
}

/**
 * bring up forgot-password dialogs
 * @returns promise that resolves to session info if successful, otherwise null
 */
async function show():Promise<SessionInfo|null> {
    const username = await showEnterEmailStep();
    if (!username) {return null;}
    return showCodeAndNewPasswordStep(username);
}

/**
 * show the dialog for entering email code and new password
 * @param username username for the user whose password we are resetting
 * @returns SessionInfo if password is sucessfully reset and we are logged in. otherwise null.
 */
async function showCodeAndNewPasswordStep(username:string):Promise<SessionInfo|null> {
    let warn = false;
    // eslint-disable-next-line no-constant-condition, @typescript-eslint/no-unnecessary-condition
    while (true) {
        const resetData = await new ConfirmAndChoosePasswordDlg().open(username, warn);
        if (!resetData) {return null;}
        warn = true;
        try {
            const sessionInfo = await resetPassword(resetData);
            if (!sessionInfo) {continue;}
            return sessionInfo;
        } catch (error: unknown) {
            await showError('Error', 'Error resetting password', error);
            return null;
        }
    }
}

/**
 * bring up forgot-password dialogs
 * @returns promise that resolves to username if the email was successfully sent
 */
async function showEnterEmailStep():Promise<string> {
    const submitOnEnter = async (event:KeyboardEvent):Promise<void>=>{
        if ((event.code === 'NumpadEnter') || (event.code === 'Enter')) {
            event.preventDefault();
            await sendPasswordResetCode(usernameField.value);
            const element = document.getElementById('idSubmitRequest');
            if (!(element instanceof HTMLButtonElement)) {return;}
            element.click();
        }
    };
    const usernameField = createElement({
        t:'input',
        a:{type:'text', required:'true', placeholder:'Username or email', autocomplete:'email'},
        id:'requestResetDlgUsername',
        events:{keyup:submitOnEnter as unknown as EventListener}
    });
    const username = await showDialog<string>(
        null,
        'requestReset',
        [
            {t:'h1', txt:'Forgot your password?'},
            {t:'p', txt:'Enter your username or email below and we will send a message to reset your password.'},
            usernameField
        ],
        [
            {label:'Reset my password', id:'idSubmitRequest', callback:async ()=>sendPasswordResetCode(usernameField.value)},
            {label:'Cancel'}
        ]
    );
    return username ?? '';
}

export default show;
