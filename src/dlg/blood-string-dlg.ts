/**
 * dialog to prompt for a string
 * @module StringDlg
 */
import { createElement, CreateElementsOptions } from '../util';
import {AriaDialog, ButtonCfg} from './aria-dlg';

type Validation = {
    pattern:string;
    hint?:string;
    warningsFn?:(input:string, container:HTMLElement)=>void;
    validateFn?:(input:string)=>boolean;
};

class StringDialog extends AriaDialog<string> {
    async open(
        title:string,
        prompt:string,
        defaultValue:string,
        validation?:Validation
    ):Promise<string|null> {
        const inputField = createElement({t:'input', a:{
            required:'true',
            type:'text',
            value:defaultValue,
            pattern:(validation?.pattern) ? validation.pattern : '',
            title:(validation?.hint) ? validation.hint : ''
        }});
        const warningsContainer = createElement({t:'div', css:['column'], a:{style:'color:red;width:400px;'}});
        const body:CreateElementsOptions = [{
            t:'h1',
            txt:title
        }, {
            t:'span',
            a:{role:'alert'},
            txt:prompt
        }, inputField,
        warningsContainer];

        // submit on enter
        // TODO: DRY: make some kind of submitOnEnter function instead of duping this code
        inputField.addEventListener('keyup', (event:KeyboardEvent):void=>{
            switch (event.code)
            {
                case 'NumpadEnter':
                case 'Enter':
                    event.preventDefault();
                    this.close(inputField.value);
                    break;
                default:
                    // others ignored
                    break;
            }
        });

        // tie validation to button's "disabled" attribute
        const validateFn = validation?.validateFn;
        if (validateFn) {
            const syncToButton = ()=>{
                const buttonElem = document.getElementById('stringOkButton');
                if (!(buttonElem instanceof HTMLButtonElement)) {return;}
                buttonElem.disabled = !(validateFn(inputField.value));
            };
            inputField.addEventListener('change', syncToButton);
            inputField.addEventListener('input', syncToButton);
        }

        // if there is a warnings function, hook it up
        const warningsFn = validation?.warningsFn;
        if (warningsFn) {
            const syncWarnings = ()=> { warningsFn(inputField.value, warningsContainer); };
            inputField.addEventListener('change', syncWarnings);
            inputField.addEventListener('input', syncWarnings);
        }
        const buttons:ButtonCfg<string|null>[] = [
            {label:'OK', callback:() => inputField.value, id:'stringOkButton', disabled:Boolean(validateFn)},
            {label:'Cancel'}
        ];

        return this.baseOpen(
            document.activeElement,
            'string',
            body,
            buttons
        );
    }
}

/**
 * bring up the popup asking the user for a string
 * returns a promise that resolves to the entered
 * string or null if the user cancelled
 */
export async function show(title:string, prompt:string, defaultValue?:string, validation?:Validation):Promise<string|null> {
    return new StringDialog().open(title, prompt, defaultValue??'', validation);
}