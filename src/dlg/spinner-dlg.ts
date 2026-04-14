/**
 * 'please wait' style spinner popup for bloodstar clocktica
 * @module SpinnerDlg
 */
import { createElement, CreateElementsOptions } from '../util';
import {AriaDialog} from './aria-dlg';

class SpinnerDialog extends AriaDialog<null> {
    private listElement:HTMLUListElement|null = null;

    private messages = new Map<string, HTMLLIElement>();

    isOpen():boolean {return Boolean(this.listElement);}

    private bumpListSize():void {
        if (!this.listElement) {return;}
        if (!this.listElement.style.minWidth || (this.listElement.offsetWidth > Number.parseInt(this.listElement.style.minWidth, 10))) {
            this.listElement.style.minWidth = `${this.listElement.offsetWidth}px`;
        }
        if (!this.listElement.style.minHeight || (this.listElement.offsetHeight > Number.parseInt(this.listElement.style.minHeight, 10))) {
            this.listElement.style.minHeight = `${this.listElement.offsetHeight}px`;
        }
    }

    /**
     * create or add to a spinner.
     */
    add(message:string):void {
        if (!this.listElement) {
            // intentionally leaking this promise. The point of spinner is to have one popup
            // stick around with messages, so blocking here would defeat the purpose
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            this.open();
        }
        if (!this.listElement) {return;}

        if (!this.messages.has(message)) {
            const listItem = this.listElement.appendChild(createElement({
                t:'li',
                txt:message,
                a:{tabindex:'0', role:'alert'}
            }));
            this.messages.set(message, listItem);
        }
        this.bumpListSize();
    }

    /** undo add */
    remove(message:string):void {
        const listItem = this.messages.get(message);
        if (!listItem) {return;}
        this.messages.delete(message);
        listItem.remove();

        // when the last message is gone, the whole spinner dialog can go away
        if (this.messages.size===0) {
            try {
                this.close(null);
            } finally {
                this.listElement = null;
            }
        }
    }

    /** create the spinner dialog */
    private open():void {
        this._canCancel = false;
        this.listElement = createElement({
            t:'ul',
            css:['spinnerMessages']
        });
        const body:CreateElementsOptions = [
            {t:'div', css:['spinner']},
            this.listElement
        ];

        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        this.baseOpen(document.activeElement, 'spinner', body, []);
    }
}

const _spinner = new SpinnerDialog();

/**
 * show or add to a spinner until the given promise resolves
 * @param message message to display while waiting
 * @param somePromise promise to spin during
 */
export async function spinner<T>(message:string, somePromise:Promise<T>):Promise<T> {
    _spinner.add(message);
    try {
        return await somePromise;
    } finally {
        _spinner.remove(message);
    }
}