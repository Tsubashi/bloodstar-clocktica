/**
 * Model for edition data
 * @module Edition
 */
import {Property} from '../bind/bindings';
import {spinner} from '../dlg/spinner-dlg';
import {Character} from './character';
import {EditionAlmanac} from './edition-almanac';
import {EditionMeta} from './edition-meta';
import {ObservableCollection, ObservableCollectionChangeAction} from '../bind/observable-collection';
import {observableChild, observableCollection, ObservableObject, observableProperty, ObservableType, PropKey} from '../bind/observable-object';

function serializeJustIds(_:ObservableObject<Edition>, nightOrder:ObservableType):unknown {
    if (!(nightOrder instanceof ObservableCollection)) {return [];}
    return nightOrder.map((c:Character)=>c.id.get());
}
async function deserializeFromIds(object:ObservableObject<Edition>, nightOrder:ObservableType, data:unknown):Promise<void> {
    if (!(nightOrder instanceof ObservableCollection)) {return;}
    if (!Array.isArray(data)) {return;}
    const characterList = object.getCollection('characterList');
    if (!(characterList instanceof ObservableCollection)) {return;}

    const charactersById = new Map<string, Character>();
    for (const character of characterList) {
        if (!(character instanceof Character)) {
            return;
        }
        charactersById.set(character.id.get(), character);
    }

    const missingCharacters = new Set<Character>(characterList);
    const orderedCharacters = [];
    for (const id of data) {
        const character = charactersById.get(String(id));
        if (!character) {
            console.error(`deserializeFromIds: no character found for id ${id}`);
            continue;
        }
        missingCharacters.delete(character);
        orderedCharacters.push(character);
    }

    // characters left out. probably due to duplicate ids. stick them at the end
    orderedCharacters.splice(orderedCharacters.length, 0, ...missingCharacters);
    await nightOrder.set(orderedCharacters);
}

/** observable properties for a custom edition */
export class Edition extends ObservableObject<Edition> {
    /** almanac-specific edition data */
    @observableChild(EditionAlmanac)
    readonly almanac!:EditionAlmanac;

    /** characters in the edition */
    @observableCollection(Character.asyncNew)
    readonly characterList!:ObservableCollection<Character>;

    /** true when there are unsaved changes */
    @observableProperty(false, {read:false, write:false})
    readonly dirty!:Property<boolean>;

    /** contains the same Character objects as characterList, but ordered for night order */
    @observableCollection(Character.asyncNew, {customSerialize:serializeJustIds, customDeserialize:deserializeFromIds})
    readonly firstNightOrder!:ObservableCollection<Character>;

    /** data about the edition */
    @observableChild(EditionMeta)
    readonly meta!:EditionMeta;

    /** contains the same Character objects as characterList, but ordered for night order */
    @observableCollection(Character.asyncNew, {customSerialize:serializeJustIds, customDeserialize:deserializeFromIds})
    readonly otherNightOrder!:ObservableCollection<Character>;

    /** whether to render preview on a character token background like you would see on clocktower.online */
    @observableProperty(true, {read:false, write:false})
    readonly previewOnToken!:Property<boolean>;

    /** name to use when saving */
    @observableProperty('', {read:false, write:false})
    readonly saveName!:Property<string>;

    /** what to show as the current file and its status */
    @observableProperty('Bloodstar Clocktica', {read:false, write:false})
    readonly windowTitle!:Property<string>;

    /** source images that need to be saved */
    private readonly dirtySourceImages = new Set<string>();

    /** final images that need to be saved */
    private readonly dirtyFinalImages = new Set<string>();

    /** whether the logo has changed since save/open */
    private dirtyLogo = false;

    /** disable propagtion of changes when we know it is useless */
    private suspendPropagation = false;

    static async asyncNew():Promise<Edition>
    {
        const edition = new Edition();
        await edition.addNewCharacter();

        // set dirty flag when most things change and update window title when dirty or savename change
        edition.addPropertyChangedEventListener(async propName=>{
            if (edition.suspendPropagation) {return;}
            switch (propName) {
                case 'dirty':
                case 'saveName':
                    await edition.windowTitle.set(`File: ${(edition.dirty.get() ? '[unsaved changes] ' : '')}${edition.saveName.get() || '[unnamed]'}`);
                    break;
                case 'windowTitle':
                    break;
                default:
                    await edition.dirty.set(true);
                    break;
            }
        });

        // watch for dirtying of images
        edition.characterList.addItemChangedListener(async (_:number, character:Character, propName:PropKey<Character>) => {
            if (edition.suspendPropagation) {return;}
            switch (propName) {
                case 'name':
                    await character.id.set(edition.generateValidId(character.name.get(), character));
                    break;
                case 'id':
                    edition.dirtySourceImages.add(character.id.get());
                    edition.dirtyFinalImages.add(character.id.get());
                    break;
                case 'unStyledImage':
                    edition.dirtySourceImages.add(character.id.get());
                    break;
                case 'styledImage':
                    edition.dirtyFinalImages.add(character.id.get());
                    break;
                default:
                    // others ignored
                    break;
            }
        });

        // propagate character list changes to night order lists and dirty maps
        const propagateAdd = async (newItems:readonly Character[])=>{
            if (edition.suspendPropagation) {return;}
            await edition.firstNightOrder.addMany(newItems);
            await edition.otherNightOrder.addMany(newItems);
        };

        // propagate character list changes to night order lists and dirty maps
        const propagateRemoval = async (oldItems:readonly Character[])=>{
            if (edition.suspendPropagation) {return;}
            for (const character of oldItems) {
                const id = character.id.get();
                edition.dirtySourceImages.delete(id);
                edition.dirtyFinalImages.delete(id);
                await edition.firstNightOrder.deleteItem(character);
                await edition.otherNightOrder.deleteItem(character);
            }
        };

        edition.characterList.addCollectionChangedListener(async event=>{
            if (edition.suspendPropagation) {return;}
            switch (event.action) {
                case ObservableCollectionChangeAction.Add:
                    await propagateAdd(event.newItems);
                    break;
                case ObservableCollectionChangeAction.Move:
                    break;
                case ObservableCollectionChangeAction.Remove:
                    await propagateRemoval(event.oldItems);
                    break;
                case ObservableCollectionChangeAction.Replace:
                    await propagateRemoval(event.oldItems);
                    await propagateAdd(event.newItems);
                    break;
                default:
                    throw new Error(`Unhandled case "${event.action}" when propagating character list change to night order lists`);
            }
        });

        // watch for dirtying of logo
        edition.meta.logo.addListener(()=>{
            if (edition.suspendPropagation) {return;}
            edition.dirtyLogo = true;
        });

        // changing save name needs to mark all images as needing re-saving
        edition.saveName.addListener(()=>{
            if (edition.suspendPropagation) {return;}
            edition.dirtyLogo = true;
            for (const existingCharacter of edition.characterList) {
                const id = existingCharacter.id.get();
                edition.dirtySourceImages.add(id);
                edition.dirtyFinalImages.add(id);
            }
        });

        return edition;
    }

    /** add a new character to the set */
    async addNewCharacter():Promise<Character> {
        const character = await Character.asyncNew();
        await character.id.set(this.generateValidId(character.name.get(), character));
        await this.characterList.add(character);
        return character;
    }

    /**
     * get a unique id from the given basename
     * @param basename - string to base id on (usually character name)
     * @param ignoreCharacter - optional character to ignore when looking for dupe ids. Usually the character whose id you are generating
     */
    generateValidId(basename:string, ignoreCharacter?:Character):string {
        const newBase = Edition.getIdPrefix(basename);
        const suffix = this.getIdSuffix();
        let number = 0;
        let combined = `${newBase}${number||''}${suffix}`;
        let dupeFound = false;
        do {
            dupeFound = false;
            for (const character of this.characterList) {
                if (character === ignoreCharacter) {continue;}
                if (character.id.get() === combined) {
                    number++;
                    combined = `${newBase}${number||''}${suffix}`;
                    dupeFound = true;
                    break;
                }
            }
        } while (dupeFound);
        return combined;
    }

    /** update all ids (you probably changed the save name of the edition) */
    async regenIdsForNameChange():Promise<void> {
        const desiredSuffix = this.getIdSuffix();
        await Promise.all(
            this.characterList
                .filter(character=>!character.id.get().endsWith(desiredSuffix))
                .map(async character=>character.id.set(this.generateValidId(character.name.get(), character)))
        );
    }

    /** make sure there are no duplicate ids */
    private async fixDuplicateIds():Promise<void> {
        const ids = new Set<string>();
        for (const character of this.characterList) {
            let id = character.id.get();
            if (ids.has(id)) {
                while (ids.has(id)) {
                    id = this.generateValidId(character.name.get(), character);
                }
                await character.id.set(id);
            }
            ids.add(id);
        }
    }

    /** check whether image needs saving */
    isCharacterFinalImageDirty(id:string):boolean {return this.dirtyFinalImages.has(id);}

    /** check whether image needs saving */
    isCharacterSourceImageDirty(id:string):boolean {return this.dirtySourceImages.has(id);}

    /** check whether image needs saving */
    isLogoDirty():boolean {return this.dirtyLogo;}

    /** edition was just opened or saved */
    async markClean():Promise<void> {
        this.dirtySourceImages.clear();
        this.dirtyFinalImages.clear();
        this.dirtyLogo = false;
        await this.dirty.set(false);
    }

    /** mark every part of the edition as needing a save */
    async markDirty():Promise<void> {
        for (const character of this.characterList) {
            const id = character.id.get();
            this.dirtySourceImages.add(id);
            this.dirtyFinalImages.add(id);
        }
        this.dirtyLogo = true;
        await this.dirty.set(true);
    }

    /** set to opened file */
    async open(saveName:string, data:Record<string, unknown>):Promise<boolean> {
        await this.reset();
        this.suspendPropagation = true;
        await this.saveName.set(saveName);
        this.suspendPropagation = false;
        await spinner('Deserializing edition', this.deserialize(data));

        // mark all as up to date
        await this.markClean();

        // THEN fix any ids that need it
        await this.fixDuplicateIds();

        return true;
    }

    /** reset to a blank edition */
    async reset():Promise<void> {
        this.suspendPropagation = true;
        await super.reset();
        this.suspendPropagation = false;
        await this.addNewCharacter();
        await this.markClean();
    }

    /** overriding to do a last-minute id uniqification */
    async serialize():Promise<Record<string, unknown>> {
        await this.fixDuplicateIds();
        return super.serialize();
    }

    /** search the character list */
    getCharacterById(id:string):Character|null {
        for (let i=0; i<this.characterList.getLength(); ++i) {
            const character = this.characterList.get(i);
            if (!character) {continue;}
            if (character.id.get() === id) {
                return character;
            }
        }
        return null;
    }

    /** get the id prefix for the edition's characters based on a base name */
    static getIdPrefix(basename:string):string {
        return basename
            .toLowerCase()
            .replace(/[^A-Za-z0-9_]/g, '');
    }

    /** get the id suffix for the edition's characters */
    getIdSuffix():string {
        return `_${this.saveName.get().toLowerCase().replace(/[^A-Za-z0-9_]/g, '')}`;
    }

    /** update edition after an image save */
    unDirtyLogo():void {this.dirtyLogo = false;}

    /** update edition after an image save */
    unDirtyFinalImage(id:string):void {this.dirtyFinalImages.delete(id);}

    /** update edition after an image save */
    unDirtySourceImage(id:string):void {this.dirtySourceImages.delete(id);}
}
