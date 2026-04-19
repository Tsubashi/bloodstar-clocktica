/**
 * dialog for initial new/open prompt
 * @module NewOpenDlg
 */

import { Edition } from '../model/edition';
import { CreateElementsOptions } from '../util';
import {AriaDialog, ButtonCfg} from './aria-dlg';
import {newEdition} from '../commands/new';
import { promptAndOpen } from "../dlg/open-flow";

class NewOpenDlg extends AriaDialog<boolean> {
    async open(edition:Edition):Promise<boolean> {
        this._canCancel = false;
        const body:CreateElementsOptions = [{
            t:'h1',
            txt: 'Welcome'
        }, {
            t:'p',
            txt:'To get started, open an existing edition or create a new one.'
        }];
        const buttons:ButtonCfg<boolean>[] = [
            {label:'Open Existing', callback:async ()=>promptAndOpen(edition, {includeShared:true, copyWarning:true})},
            {label:'Create New', callback:async ()=>newEdition(edition)}
        ];
        const result = await this.baseOpen(
            document.activeElement,
            'newopen',
            body,
            buttons
        );
        return Boolean(result);
    }
}

/**
 * bring up dialog for picking whether to open an existing file or start a new one
 * @returns promise that resolves to whether the dialog was successful
 */
export async function show(edition:Edition):Promise<boolean> {
    return new NewOpenDlg().open(edition);
}