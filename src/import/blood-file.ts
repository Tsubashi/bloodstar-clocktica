/**
 * import code for .blood files
 * @module BloodFile
 */
import {savePromptIfDirty} from '../dlg/blood-save-discard-cancel';
import {spinner} from '../dlg/spinner-dlg';
import {Edition} from '../model/edition';
import { JSZipObject, loadAsync as loadZipAsync} from 'jszip';
import { isRecord } from '../util';
import { Character } from '../model/character';
import { Property } from '../bind/bindings';
import { ObservableCollection } from '../bind/observable-collection';
import Locks from '../lock';
import { parseBloodTeam } from '../model/blood-team';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import JSZip = require('jszip');
import { chooseFileToImport } from './shared';

/** set property if the value is not undefined */
async function trySet<T>(sourceRecord:Record<string, unknown>, key:string, property:Property<T>):Promise<void> {
    if (key in sourceRecord) {
        await property.set(sourceRecord[key] as T);
    }
}

const MAX_SIMULTANEOUS_EXTRACT = 99;
const MAX_SIMULTANEOUS_PER_CHARACTER = 99;

/** combine spinner and throttling of work */
async function spinAndThrottle<T>(key:string, message:string, work:()=>Promise<T>, max:number):Promise<T> {
    return Locks.enqueue(key, async ()=>spinner(message, work()), max);
}

class BloodImporter {
    private readonly firstNightOrderTracker = new Map<number, Character[]>();

    private readonly otherNightOrderTracker = new Map<number, Character[]>();

    private readonly charactersById = new Map<string, Character>();

    private readonly edition:Edition;

    constructor(edition:Edition) {
        this.edition = edition;
    }

    /** import a whole blood file */
    async importBlood(file:File):Promise<boolean> {
        const zip = await spinner(`Extracting ${file.name}`, loadZipAsync(file));
        const allPaths:string[] = [];
        zip.forEach(relativePath=>allPaths.push(relativePath));

        // do some of them now, defer others until after
        const deferred:string[] = await this.firstPassImport(zip, allPaths);

        // do deferred ones
        await this.remainingImports(zip, deferred);

        await this.finalizeNightOrder();

        return true;
    }

    /** import first batch of items, resolve to a list of deferred items */
    private async firstPassImport(zip:JSZip, allPaths:string[]):Promise<string[]> {
        const deferred:string[] = [];
        const promises = [];
        for (const relativePath of allPaths) {
            if (relativePath.startsWith('processed_images/')) {
                deferred.push(relativePath);
            } else {
                const zipEntry = zip.file(relativePath);
                if (!zipEntry) {throw new Error(`Error reading blood file: failed to open path '${relativePath}'`);}
                promises.push(this.importPart(relativePath, zipEntry));
            }
        }
        // wait for that batch
        await Promise.all(promises);

        return deferred;
    }

    /** import deferred items, resolve to a list of deferred items */
    private async remainingImports(zip:JSZip, paths:string[]):Promise<void> {
        const promises = [];
        for (const relativePath of paths) {
            const zipEntry = zip.file(relativePath);
            if (!zipEntry) {throw new Error(`Error reading blood file: failed to open path '${relativePath}'`);}
            promises.push(this.importPart(relativePath, zipEntry));
        }
        // await those
        await Promise.all(promises);
    }

    /** once all characters are loaded, correct the night order */
    private async finalizeNightOrder():Promise<void> {
        const data:[Map<number, Character[]>, ObservableCollection<Character>][] = [
            [this.firstNightOrderTracker, this.edition.firstNightOrder],
            [this.otherNightOrderTracker, this.edition.otherNightOrder]
        ];
        for (const [nightMap, collection] of data) {
            const keys = Array.from(nightMap.keys()).sort((a, b) => a - b);
            await collection.clear();
            for (const key of keys) {
                await collection.addMany(nightMap.get(key) ?? []);
            }
        }
    }

    /** load from the meta portion of a .blood into the edition */
    private async importMeta(zipEntry:JSZipObject):Promise<boolean> {
        const text = await spinAndThrottle('zip', `Extracting ${zipEntry.name}`, async ()=>zipEntry.async('text'), MAX_SIMULTANEOUS_EXTRACT);
        const json = JSON.parse(text);
        if (!isRecord(json)) {return false;}
        await trySet(json, 'name', this.edition.meta.name);
        await trySet(json, 'author', this.edition.meta.author);
        await trySet(json, 'synopsis', this.edition.almanac.synopsis);
        await trySet(json, 'overview', this.edition.almanac.overview);
        return true;
    }

    /** load a processed image from the .blood file */
    private async importProcessedImage(character:Character, zipEntry:JSZipObject):Promise<boolean> {
        const id = character.id.get();
        if (character.unStyledImage.get()) { return true; } // don't clobber source image
        const base64 = await spinAndThrottle('zip', `Extracting ${zipEntry.name}`, async ()=>zipEntry.async('base64'), MAX_SIMULTANEOUS_EXTRACT);
        await spinner(`Setting Image for "${id}"`, character.unStyledImage.set(`data:image/png;base64,${base64}`));
        await spinner(`Setting Image for "${id}"`, character.imageSettings.shouldRestyle.set(false)); // image is pre-processed
        this.charactersById.set(id, character);
        return true;
    }

    /** make sure that a character exists in the edition/map before continuing */
    private async ensureCharacter(id:string):Promise<Character> {
        return spinAndThrottle('ensureCharacter', `Creating ${id}`, async ()=>{
            let character = this.charactersById.get(id);
            if (!character) {
                character = await this.edition.addNewCharacter();
                await character.id.set(id);
                this.charactersById.set(id, character);
            }
            return character;
        }, 1);
    }

    /** import part of a .blood file */
    private async importPart(relativePath:string, zipEntry:JSZipObject):Promise<boolean> {
        if (relativePath === 'logo.png') {
            const base64 = await spinAndThrottle('zip', `Extracting ${relativePath}`, async ()=>zipEntry.async('base64'), MAX_SIMULTANEOUS_EXTRACT);
            await spinner(`Setting logo image`, this.edition.meta.logo.set(`data:image/png;base64,${base64}`));
            return true;
        } else if (relativePath === 'meta.json') {
            return this.importMeta(zipEntry);
        } else if (relativePath.startsWith('roles/') && relativePath.endsWith('.json')) {
            const id = relativePath.slice(6, relativePath.length - 5);
            const character = await this.ensureCharacter(id);
            return spinner(`Importing character "${id}"`, this.importRole(character, zipEntry));
        } else if (relativePath.startsWith('src_images/') && relativePath.endsWith('.png')) {
            const id = relativePath.slice(11, relativePath.length - 4);
            const character = await this.ensureCharacter(id);
            return spinAndThrottle(
                id,
                `Importing ${relativePath}`,
                async ()=>this.importSourceImage(character, zipEntry),
                MAX_SIMULTANEOUS_PER_CHARACTER
            );
        } else if (relativePath.startsWith('processed_images/') && relativePath.endsWith('.png')) {
            const id = relativePath.slice(17, relativePath.length - 4);
            const character = await this.ensureCharacter(id);
            return spinAndThrottle(
                id,
                `Importing ${relativePath}`,
                async ()=>this.importProcessedImage(character, zipEntry),
                MAX_SIMULTANEOUS_PER_CHARACTER
            );
        }
        console.error(`unhandled bloodfile part "${relativePath}"`);
        return false;
    }

    /** load a json from the roles directory of the .blood file */
    private async importRole(character:Character, zipEntry:JSZipObject):Promise<boolean> {
        const text = await spinAndThrottle('zip', `Extracting ${zipEntry.name}`, async ()=>zipEntry.async('text'), MAX_SIMULTANEOUS_EXTRACT);
        const json = JSON.parse(text);
        await trySet(json, 'name', character.name);
        await trySet(json, 'setup', character.setup);
        await trySet(json, 'ability', character.ability);
        await trySet(json, 'firstNightReminder', character.firstNightReminder);
        await trySet(json, 'otherNightReminder', character.otherNightReminder);
        await trySet(json, 'includeInExport', character.export);

        const almanac = json.almanacEntry;
        if (almanac) {
            await trySet(almanac, 'flavor', character.almanac.flavor);
            await trySet(almanac, 'overview', character.almanac.overview);
            await trySet(almanac, 'examples', character.almanac.examples);
            await trySet(almanac, 'howToRun', character.almanac.howToRun);
            await trySet(almanac, 'tip', character.almanac.tip);
        }

        if (json.team) {
            await character.team.set(parseBloodTeam(json.team));
        }
        if (json.reminders) {
            await character.characterReminderTokens.set(json.reminders.join('\n'));
        }
        if (json.globalReminders) {
            await character.globalReminderTokens.set(json.globalReminders.join('\n'));
        }

        const firstNightNumber = json.firstNight || 0;
        const fno = this.firstNightOrderTracker.get(firstNightNumber) ?? [];
        fno.push(character);
        this.firstNightOrderTracker.set(firstNightNumber, fno);

        const otherNightNumber = json.otherNight || 0;
        const ono = this.otherNightOrderTracker.get(otherNightNumber) ?? [];
        ono.push(character);
        this.otherNightOrderTracker.set(otherNightNumber, ono);

        this.charactersById.set(character.id.get(), character);
        return true;
    }

    /** load a source image from the .blood file */
    private async importSourceImage(character:Character, zipEntry:JSZipObject):Promise<boolean> {
        const id = character.id.get();
        const base64 = await spinAndThrottle('zip', `Extracting "${zipEntry.name}"`, async ()=>zipEntry.async('base64'), MAX_SIMULTANEOUS_EXTRACT);
        await character.unStyledImage.set(`data:image/png;base64,${base64}`);
        await character.imageSettings.shouldRestyle.set(true); // restore if set by importProcessedImage
        this.charactersById.set(id, character);
        return true;
    }
}

/** user chose to import a project form the windows version of Bloodstar Clocktica */
export async function importBlood(edition:Edition):Promise<boolean> {
    if (!await savePromptIfDirty(edition)) {return false;}
    return importBloodFile(edition);
}

/** user chose to import a .blood file */
export async function importBloodFile(edition:Edition):Promise<boolean> {
    if (!await savePromptIfDirty(edition)) {return false;}
    const file = await chooseFileToImport('.blood');
    if (!file) {return false;}
    await edition.reset();
    await edition.characterList.clear();
    const importer = new BloodImporter(edition);
    return await spinner('Importing .blood', importer.importBlood(file)) || false;
}
