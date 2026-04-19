/**
 * dialog to prompt for a string
 * @module MessageDlg
 */
import { CreateElementsOptions } from '../util';
import {AriaDialog} from './aria-dlg';

class MessageDialog extends AriaDialog<void> {
    async open(focusAfterClose:Element|string|null, titleText:string, messageText?:string, errorMessage?:string):Promise<null> {
        const body:CreateElementsOptions = [{
            t:'h1',
            txt:titleText
        }];

        if (messageText) {
            body.push({t:'p', txt:messageText});
        }

        if (errorMessage) {
            body.push({t:'pre', txt:errorMessage});
        }

        await this.baseOpen(
            focusAfterClose,
            'message',
            body,
            [{ label: 'OK' }]
        );
        return null;
    }
}

let errorMessages = 0;

/**
 * bring up the popup showing exception information
 */
export async function showError(
    title = 'Error',
    message = 'It looks like you encountered a bug! The error message below may help the developers fix it.',
    error:unknown = undefined
):Promise<void> {
    if (errorMessages===0) {
        const errorMessage = (error instanceof Error) ? `${error.message}` : `${error ?? ''}`;
        ++errorMessages;
        try {
            await new MessageDialog().open(document.activeElement, title, message, errorMessage);
        } finally {
            --errorMessages;
        }
    }
}
/**
 * bring up the popup showing exception information
 */
export function showErrorNoWait(
    title = 'Error',
    message = 'It looks like you encountered a bug! The error message below may help the developers fix it.',
    error:Error|unknown = undefined
):void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    showError(title, message, error);
}

/**
 * bring up the popup showing a message
 */
export async function show(titleText:string, messageText?:string):Promise<null> {
    return new MessageDialog().open(document.activeElement, titleText, messageText);
}

/**
 * bring up the popup showing a message
 */
export function showNoWait(titleText:string, messageText?:string):void {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    show(titleText, messageText);
}
