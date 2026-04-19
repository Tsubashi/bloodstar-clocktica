/**
 * Code related to deleting files
 * @module Delete
 */
import { show as showMessage } from '../dlg/blood-message-dlg';
import {chooseFile} from "../dlg/open-flow";
import { clearRecentFile } from '../recent-file';
import genericCmd from './generic-cmd';

type DeleteRequest = {token:string; saveName:string};
type DeleteResponse = true;

/**
 * Bring up a list of deletable files, and let the user delete from there
 * @returns promise that resolves to the name of the deleted file, or empty string if nothing was deleted
 */
export async function chooseAndDeleteFile():Promise<string> {
    const name = await chooseFile({message:'Choose an existing file to delete:', includeShared:false});
    if (!name) {return '';}

    // can't delete shared files
    if (Array.isArray(name)) {return '';}

    const result = await genericCmd<DeleteRequest, DeleteResponse>({
        command:'delete',
        confirmOptions:{
            checkboxMessage:`Yes, I am certain I want to delete file "${name}"`,
            message:`Are you sure you'd like to delete "${name}"? This file will be lost forever!`,
            noLabel:'Cancel',
            title:'Confirm Delete',
            yesLabel: `Yes, delete "${name}"`,
        },
        errorMessage:`Error encountered while trying to delete file ${name}`,
        request:sessionInfo=>({
            token:sessionInfo?.token??'',
            saveName: name
        }),
        signIn:{title:'Sign In to Delete', message:'You must be signed in to delete a file.'},
        spinnerMessage:`Deleting ${name}`
    });

    if ('error' in result) {return '';}
    if ('cancel' in result) {return '';}

    clearRecentFile(name);
    await showMessage(`Deleted`, `File "${name}" deleted`);
    return name;
}
