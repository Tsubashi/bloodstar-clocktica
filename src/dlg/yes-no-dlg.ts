/**
 * confirmation dialog
 * @module YesNoDlg
 */
import { CreateElementsOptions } from '../util';
import {AriaDialog} from './aria-dlg';

export type YesNoOptions = {
    /**
     * Label to place on the checkbox.
     * If present and not empty, a checkbox is present and must be checked in order for the dialog to result in true.
     * If not present or empty, no checkbox appears
     */
    checkboxMessage?:string;

    /** question you are answering */
    message?:string;

    /** how to label the No button. default: 'No' */
    noLabel?:string;

    /** popup title */
    title:string;

    /** how to label the Yes button. default: 'Yes' */
    yesLabel?:string;
};

class YesNoDialog extends AriaDialog<boolean> {
    async open(options:YesNoOptions):Promise<boolean> {
        const yesLabel = options.yesLabel ?? 'Yes';
        const noLabel = options.noLabel ?? 'No';
        const checkboxMessage = options.checkboxMessage ?? '';

        const body:CreateElementsOptions = [{
            t:'h1',
            txt:options.title
        }];

        if (options.message) {
            body.push({t:'p', txt:options.message});
        }

        if (checkboxMessage) {
            const syncToButton = ():void=>{
                const checkboxElem = this.querySelector<HTMLInputElement>('#confirmCheckbox');
                if (!checkboxElem) {return;}
                const buttonElem = this.querySelector<HTMLButtonElement>('#yesButton');
                if (!buttonElem) {return;}
                buttonElem.disabled = !checkboxElem.checked;
            };
            body.push({t:'div', css:['twoColumnGrid'], children:[
                {
                    t:'input',
                    a:{type:'checkbox', id:'confirmCheckbox', name:'confirmCheckbox'},
                    events:{change:syncToButton}
                },
                {t:'label', a:{'for':'confirmCheckbox'}, txt:checkboxMessage}
            ]});
        }

        const yesCallback = ():boolean=>{
            if (!checkboxMessage) { return true; }
            const checkboxElem = this.querySelector<HTMLInputElement>('#confirmCheckbox');
            if (!checkboxElem) {return false;}
            return checkboxElem.checked;
        };
        const result = await this.baseOpen(
            document.activeElement,
            'message',
            body,
            [
                {label:yesLabel, id:'yesButton', callback:yesCallback, disabled:Boolean(checkboxMessage)},
                {label:noLabel, callback:() => false}
            ]
        );
        return Boolean(result);
    }
}

/** bring up the confirmation dialog */
export async function show(options:YesNoOptions):Promise<boolean> {
    return new YesNoDialog().open(options);
}
