/**
 * dialog to prompt for username and password
 * @module SignInFlow
 */
import { CreateElementsOptions } from '../util';
import {AriaDialog} from './aria-dlg';
import showSignUpFlow from './sign-up-flow';
import showResetPasswordFlow from './reset-password-flow';
import { SessionInfo, signIn } from '../iam';

export type SignInFlowOptions = {
    /** set true to make dialog cancelable */
    canCancel?:boolean;

    /** change the label on the cancel button */
    cancelLabel?:string;

    /** set false to remove forgot password link */
    includeForgotPasswordLink?:boolean;

    /** set false to remove signup link */
    includeSignUpLink?:boolean;

    /** extra text about why you are being asked to sign in */
    message?:string;

    /** optional prompt */
    title?:string;
};

class SignInDlg extends AriaDialog<SessionInfo> {
    canCancel():boolean {return this._canCancel;}

    /** get a value from a field by id */
    private getValue(id:string):string {
        const inputElement = this.querySelector<HTMLInputElement>(`#${id}`);
        return inputElement ? inputElement.value : '';
    }

    async open(options?:SignInFlowOptions):Promise<SessionInfo|null> {
        this._canCancel = options?.canCancel !== false;
        const title = options?.title ?? 'Sign In';
        const submitOnEnter = async (event:KeyboardEvent):Promise<void>=>{
            switch (event.code)
            {
                case 'NumpadEnter':
                case 'Enter':
                    event.preventDefault();
                    this.close(await this.signIn());
                    break;
                default:
                    // others ignored
                    break;
            }
        };

        // title
        const body:CreateElementsOptions = [{
            t:'h1',
            a:{role:'alert'},
            txt:title,
        }];

        // message
        const message = options?.message;
        if (message) {
            body.push({
                t:'p',
                txt:message
            });
        }

        // main fields
        body.push({
            t:'div',
            css:['twoColumnGrid'],
            children:[{
                t:'label',
                a:{'for':'signInDlgUsername'},
                txt:'Username or email'
            },
            {
                t:'input',
                a:{type:'text', required:'true', id:'signInDlgUsername', placeholder:'Username or email', autocomplete:'username', autofocus:'true'},
                events:{keyup:submitOnEnter as unknown as EventListener}
            }, {
                t:'label',
                a:{'for':'signInDlgPassword'},
                txt:'Password'
            }, {
                t:'input',
                a:{type:'password', required:'true', id:'signInDlgPassword', placeholder:'Password', autocomplete:'current-password'},
                events:{keyup:submitOnEnter as unknown as EventListener}
            }]
        });

        // forgot password link
        const includeForgotPasswordLink = (options?.includeForgotPasswordLink) !== false;
        if (includeForgotPasswordLink) {
            body.push({
                t:'a',
                a:{href:'#', style:'align-self:center'},
                txt:'Forgot your password?',
                events:{click:async ()=>{ this.close(await showResetPasswordFlow()); }}
            });
        }

        // sign in button
        body.push({
            t:'button',
            txt:'Sign in',
            events:{click:async ()=>{ this.close(await this.signIn()); }}
        });

        // cancel button
        if (this._canCancel) {
            body.push({
                t:'button',
                txt:options?.cancelLabel ?? 'Cancel',
                events:{click:()=>{ this.close(null); }}
            });
        }

        // sign up link
        const includeSignUpLink = (options?.includeSignUpLink) !== false;
        if (includeSignUpLink) {
            body.push({
                t:'div',
                txt:'Need an account? ',
                a:{style:'align-self:center'},
                children:[{
                    t:'a',
                    a:{href:'#'},
                    txt:'Sign Up',
                    events:{click:async ()=>{
                        const signUpResult = await showSignUpFlow();
                        if (signUpResult) {
                            this.close(signUpResult);
                        }
                    }}
                }]
            });
        }

        return this.baseOpen(
            document.activeElement,
            'sign-in',
            body,
            []
        );
    }

    /** look at input elements to get dialog result value */
    private async signIn():Promise<SessionInfo|null> {
        const username = this.getValue('signInDlgUsername');
        const password = this.getValue('signInDlgPassword');
        return signIn(username, password);
    }
}

/**
 * bring up the popup asking the user for a string
 * returns a promise that resolves to the entered
 * string or null if the user cancelled
 */
export async function show(options?:SignInFlowOptions):Promise<SessionInfo|null> {
    return new SignInDlg().open(options);
}
