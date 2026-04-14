/**
 * code for importing from Bloodstar saves
 * @module ImportShared
 */
import { AriaDialog } from '../dlg/aria-dlg';
import { showError } from '../dlg/blood-message-dlg';
import { chooseFile, openEditionFile } from '../dlg/open-flow';
import {spinner} from '../dlg/spinner-dlg';
import { Edition } from "../model/edition";
import { createElement } from '../util';
import { ChooseCharactersDlg } from './choose-characters-dlg';
import { ScriptEntry } from './json';


/** dialog subclass for choosing an official character to clone */
class ChooseCharacterFromEditionDlg extends ChooseCharactersDlg {
    troubleBrewingSection!:HTMLElement;

    badMoonRisingSection!:HTMLElement;

    sectsAndVioletsSection!:HTMLElement;

    otherEditionsSection!:HTMLElement;

    /** bring up the dialog, return chosen characters */
    public static async open(edition:Edition):Promise<string[]> {
        const characters:ScriptEntry[] = [];
        characters.push({
            id:'_meta',
            name:edition.meta.name.get(),
            author:edition.meta.author.get(),
            logo:edition.meta.logo.get()??undefined
        });
        for (let i=0; i<edition.characterList.getLength(); ++i) {
            const character = edition.characterList.get(i);
            if (!character) {continue;}
            characters.push({
                id:character.id.get(),
                image:character.styledImage.get()??undefined,
                edition:character.id.get(),
                firstNightReminder:character.firstNightReminder.get(),
                otherNightReminder:character.otherNightReminder.get(),
                reminders:character.characterReminderTokens.get().split('\n'),
                remindersGlobal:character.globalReminderTokens.get().split('\n'),
                setup:character.setup.get(),
                name:character.name.get(),
                team:character.team.get(),
                ability:character.ability.get(),
            });
        }
        const choices = await new ChooseCharacterFromEditionDlg().open(characters);
        return choices.map(c=>c.id);
    }
}

/**
 * let the user choose and import a character from a Bloodstar save
 */
export default async function importShared(edition:Edition):Promise<boolean> {
    const file = await chooseFile({title:'Import', message:'Choose a file to import from', includeShared:true});
    if (!file) {return false;}
    const label = Array.isArray(file) ? file.join(' / ') : file;

    try {
        return await _importShared(edition, file);
    } catch (error: unknown) {
        await showError('Error', `Error encountered while trying to import ${label}`, error);
        return false;
    }
}

/** import character from chosen save */
async function _importShared(edition:Edition, file:string|[string, string]):Promise<boolean> {
    const data = await openEditionFile(file, {
        title:'Sign In to Open',
        message:'You must first sign in to import.'
    });
    if (!data) {return false;}
    const label = Array.isArray(file) ? file.join(' / ') : file;

    // load into temp Edition
    const tempEdition = await Edition.asyncNew();
    if (!await spinner(`Opening edition file "${label}"`, tempEdition.open(label, data)))
    {
        await showError('Error', `Error parsing "${label}"`);
        return false;
    }

    // choose characters
    const characters = await ChooseCharacterFromEditionDlg.open(tempEdition);

    // add chosen characters to Edition
    const promises:Promise<unknown>[] = [];
    characters.forEach(id=>{
        if (id === '_meta') {
            edition.forEachChild((childKey, observableObject)=>{
                observableObject.forEachProperty((propKey, property)=>{
                    promises.push(property.set(tempEdition.getChild(childKey).getPropertyValue(propKey)));
                });
                observableObject.forEachCollection(()=>{
                    throw new Error("Not yet implemented (_importShared collection case)");
                });
                observableObject.forEachChild(()=>{
                    throw new Error("Not yet implemented (_importShared child case)");
                });
            });
            return;
        }
        const character = tempEdition.getCharacterById(id);
        if (!character) {return;}
        const newId = edition.generateValidId(character.name.get());
        promises.push(character.id.set(newId));
        promises.push(edition.characterList.add(character));
    });
    await Promise.all(promises);
    return true;
}

/** promise for choosing a file */
export async function chooseFileToImport(accept:string):Promise<File|null> {
    const fileInput = createElement({t:'input', a:{type:'file', accept}, css:['hidden']});
    if (!(fileInput instanceof HTMLInputElement)) {return Promise.resolve(null);}
    const dlg = new AriaDialog<File|null>();

    function onChooseFile():void {
        if (fileInput instanceof HTMLInputElement) {
            fileInput.onchange=()=>{
                dlg.close(fileInput.files?.[0]);
            };
            fileInput.click();
        } else {
            dlg.close(null);
        }
    }

    return dlg.baseOpen(
        document.activeElement,
        'chooseFileToImport',
        [
            {t:'h1', txt:'Choose file'},
            {t:'p', txt:'Choose a .blood file to import.'},
            {t:'div', css:['dialogBtnGroup'], children:[
                {t:'button', txt:'Choose File', events:{click:()=>{ onChooseFile(); }}},
                {t:'button', txt:'Cancel', events:{click:()=>{ dlg.close(); }}}
            ]}
        ],
        []
    );
}