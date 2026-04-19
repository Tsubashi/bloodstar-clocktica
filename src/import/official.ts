/**
 * code for importing official characters
 * @module ImportOfficial
 */

import {spinner} from '../dlg/spinner-dlg';
import { Edition } from "../model/edition";
import { createElement, fetchJson } from "../util";
import { CharacterEntry } from "./json";
import { ProcessImageSettings, urlToCanvas } from "../blood-image";
import { Character } from "../model/character";
import {ChooseCharactersDlg} from './choose-characters-dlg';
import { parseBloodTeam } from '../model/blood-team';

/** dialog subclass for choosing an official character to clone */
class ChooseOfficialCharDlg extends ChooseCharactersDlg {
    troubleBrewingSection!:HTMLElement;

    badMoonRisingSection!:HTMLElement;

    sectsAndVioletsSection!:HTMLElement;

    otherEditionsSection!:HTMLElement;

    /** override for custom layout */
    protected addElementForCharacter(character:CharacterEntry, _container:HTMLElement, characterElement:HTMLElement):void {
        switch (character.edition) {
            case 'tb': this.troubleBrewingSection.appendChild(characterElement); break;
            case 'bmr': this.badMoonRisingSection.appendChild(characterElement); break;
            case 'snv': this.sectsAndVioletsSection.appendChild(characterElement); break;
            default: this.otherEditionsSection.appendChild(characterElement); break;
        }
    }

    /** override for custom layout */
    protected makeContainer():HTMLElement {
        this.troubleBrewingSection = createElement({t:'details', children:[{t:'summary', txt:'Trouble Brewing'}], a:{open:''}});
        this.badMoonRisingSection = createElement({t:'details', children:[{t:'summary', txt:'Bad Moon Rising'}], a:{open:''}});
        this.sectsAndVioletsSection = createElement({t:'details', children:[{t:'summary', txt:'Sects and Violets'}], a:{open:''}});
        this.otherEditionsSection = createElement({t:'details', children:[{t:'summary', txt:'Other'}], a:{open:''}});
        return createElement({t:'div', css:['importOfficialList'], children:[
            this.troubleBrewingSection,
            this.badMoonRisingSection,
            this.sectsAndVioletsSection,
            this.otherEditionsSection]});
    }
}

/**
 * let the user choose and import an official character
 */
export default async function importOfficial(edition:Edition):Promise<boolean> {
    const rolesJson = await spinner(
        'Fetching official characters',
        fetchJson<CharacterEntry[]>('https://raw.githubusercontent.com/bra1n/townsquare/main/src/roles.json')
    );
    if (!rolesJson) {return false;}
    const fabledJson = await spinner(
        'Fetching official fabled',
        fetchJson<CharacterEntry[]>('https://raw.githubusercontent.com/bra1n/townsquare/main/src/fabled.json')
    );
    if (!fabledJson) {return false;}
    const combined = rolesJson.concat(fabledJson);
    const choices = await new ChooseOfficialCharDlg().open(combined);

    const results = await Promise.all(choices.map(async choice=>{
        const character = await edition.addNewCharacter();
        try {
            return await _importOfficial(choice, character, edition);
        } catch (error: unknown) {
            await edition.characterList.deleteItem(character);
            throw error;
        }
    }));
    return results.reduce((a, b)=>a&&b, true);
}

/** load from the character entry to the character object */
async function _importOfficial(fromCharacter:CharacterEntry, toCharacter:Character, edition:Edition):Promise<boolean> {
    if (fromCharacter.ability) {
        await toCharacter.ability.set(fromCharacter.ability);
    }
    if (fromCharacter.firstNightReminder) {
        await toCharacter.firstNightReminder.set(fromCharacter.firstNightReminder);
    }
    if (fromCharacter.id) {
        const newId = edition.generateValidId(fromCharacter.name??'newcharacter');
        await toCharacter.id.set(newId);
    }

    const url = `https://github.com/bra1n/townsquare/raw/main/src/assets/icons/${fromCharacter.id}.png`;
    const canvas = await spinner(
        `Downloading image for ${fromCharacter.name}`,
        urlToCanvas(url, ProcessImageSettings.FULL_WIDTH, ProcessImageSettings.FULL_HEIGHT)
    );
    const dataUrl = canvas.toDataURL('image/png');
    await toCharacter.imageSettings.shouldRestyle.set(false);
    await spinner(`Setting character image for ${fromCharacter.name}`, toCharacter.unStyledImage.set(dataUrl));

    if (fromCharacter.name) {
        await toCharacter.name.set(fromCharacter.name);
    }
    if (fromCharacter.otherNightReminder) {
        await toCharacter.otherNightReminder.set(fromCharacter.otherNightReminder);
    }
    if (fromCharacter.reminders) {
        await toCharacter.characterReminderTokens.set(fromCharacter.reminders.join('\n'));
    }
    if (fromCharacter.remindersGlobal) {
        await toCharacter.globalReminderTokens.set(fromCharacter.remindersGlobal.join('\n'));
    }
    if (fromCharacter.setup) {
        await toCharacter.setup.set(fromCharacter.setup);
    }
    if (fromCharacter.team) {
        await toCharacter.team.set(parseBloodTeam(fromCharacter.team));
    }
    return true;
}
