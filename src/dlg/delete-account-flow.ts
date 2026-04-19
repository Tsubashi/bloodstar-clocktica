/**
 * dialog chain for deleting your account
 * @module DeleteAccountFlow
 */
import { show as showMessage } from "../dlg/blood-message-dlg";
import signIn, { signOut } from "../sign-in";
import { AriaDialog } from "../dlg/aria-dlg";
import { createElement } from "../util";
import genericCmd from "../commands/generic-cmd";

type DeleteAccountRequest = {token:string; password:string};
type DeleteAccountResponse = true;

/** user chose to delete their account */
export async function deleteAccount():Promise<boolean> {
    const sessionInfo = await signIn({
        canCancel:true,
        title:'Confirm Account',
        message:'Sign in again to confirm account deletion',
        includeForgotPasswordLink:false,
        includeSignUpLink:false
    });
    if (!sessionInfo) {return false;}
    const password = await new PasswordDlg().open();
    if (!password) {return false;}
    const result = await genericCmd<DeleteAccountRequest, DeleteAccountResponse>({
        command:'deleteaccount',
        confirmOptions:{
            checkboxMessage:'Yes, I am certain I want to permanently delete my account',
            message:`Are you sure you'd like to the account associated with username "${sessionInfo.username}" and email "${sessionInfo.email}"?` +
                ' You will not be able to recover your account!',
            noLabel:'Cancel',
            title:'Confirm Delete',
            yesLabel:'Delete my account'
        },
        errorMessage: 'Deleting account',
        request: sess=>({
            token:sess?.token ?? '',
            password
        }),
        signIn:{message:'Sign in delete account'},
        spinnerMessage: 'Deleting account'
    });
    if ('error' in result) {return false;}
    if ('cancel' in result) {return false;}

    await showMessage('Done', 'Account deleted');
    signOut();
    return Boolean(await signIn());
}

class PasswordDlg extends AriaDialog<string> {
    async open():Promise<string> {
        const passwordField = createElement({
            t:'input',
            a:{type:'password', required:'true', placeholder:'Password', autocomplete:'current-password'}
        });
        passwordField.addEventListener('keyup', (event:KeyboardEvent):void=>{
            switch (event.code)
            {
                case 'NumpadEnter':
                case 'Enter':
                    event.preventDefault();
                    this.close(passwordField.value);
                    break;
                default:
                    // others ignored
                    break;
            }
        });
        return await this.baseOpen(
            document.activeElement,
            'pwd-for-del-accnt',
            [
                {t:'h1', txt:'Enter Password'},
                {t:'p', txt:'Enter your password to continue deleting your account.'},
                passwordField],
            [
                {label:'OK', id:'pwdOkButton', callback:()=>passwordField.value},
                {label:'Cancel'}]
        )??'';
    }
}