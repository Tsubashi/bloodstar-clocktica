/**
 * dialog for choosing an official character to clone
 * @module ChooseCharactersDlg
 */
import {AriaDialog} from '../dlg/aria-dlg';
import { createElement, walkHTMLElements } from '../util';
import { ScriptEntry } from "./json";
import { parseBloodTeam } from "../model/blood-team";
import { setTeamColorStyle } from "../team-color";

/** convert list of entries to map by id */
function toMap(entries:ScriptEntry[]):Map<string, ScriptEntry> {
    const map = new Map<string, ScriptEntry>();
    for (const entry of entries) {
        map.set(entry.id, entry);
    }
    return map;
}

/** dialog subclass for choosing an official character to clone */
export class ChooseCharactersDlg extends AriaDialog<ScriptEntry[]> {

    /** override for custom layout */
    protected static addElementForCharacter(_character:ScriptEntry, container:HTMLElement, characterElement:HTMLElement):void {
        container.appendChild(characterElement);
    }

    /** override for custom layout */
    protected static makeContainer():HTMLElement {
        return createElement({t:'div', css:['importOfficialList']});
    }

    async open(json:ScriptEntry[]):Promise<ScriptEntry[]> {
        const entriesById = toMap(json);
        const container = ChooseCharactersDlg.makeContainer();
        const onFilterChange=async (e:Event)=>{
            if (e.target instanceof HTMLInputElement) {
                const filterString = e.target.value;
                return walkHTMLElements(container, async elem=>{
                    doFilter(filterString, entriesById, elem);
                });
            }
            return Promise.resolve();
        };
        const updateButton = ():void=>{
            const buttonElem = this.querySelector<HTMLButtonElement>('#importButton');
            if (!buttonElem) {return;}
            const foundCharacters = container.querySelectorAll('input:checked');
            buttonElem.innerText = `Import ${foundCharacters.length} Characters`;
            buttonElem.disabled = foundCharacters.length===0;
        };
        const doImport = ():ScriptEntry[]=>{
            const selected = container.querySelectorAll('input:checked');
            const selectedCharacters = [];
            for (let i=0; i<selected.length; ++i) {
                const checkbox = selected[i] as HTMLElement;
                const characterId = checkbox.dataset.id;
                if (!characterId) {continue;}
                const characterEntry = entriesById.get(characterId);
                if (!characterEntry) {continue;}
                selectedCharacters.push(characterEntry);
            }
            return selectedCharacters;
        };
        const filterRow = createElement({
            t:'div',
            css:['row'],
            children:[
                {t:'label', a:{'for':'chooseOfficialFilter'}, txt:'Filter'},
                {
                    t:'input', id:'chooseOfficialFilter', a:{name:'chooseOfficialFilter'},
                    events:{change:onFilterChange, input:onFilterChange},
                },
                // clear filter button
                {t:'button', txt:'Clear Filter', events:{click:()=>{
                    const filterTextBox = filterRow.querySelector('#chooseOfficialFilter');
                    if (!(filterTextBox instanceof HTMLInputElement)) {return;}
                    filterTextBox.value = '';
                    filterTextBox.dispatchEvent(new Event('change'));
                }}},
                // select all button
                {t:'button', txt:'Select All', events:{click:()=>{
                    const checkBoxes = container.querySelectorAll('input[type=checkbox]');
                    for (let i=0; i<checkBoxes.length; ++i) {
                        const checkbox = checkBoxes[i] as HTMLInputElement;
                        checkbox.checked=true;
                    }
                    updateButton();
                }}},
                // unselect all button
                {t:'button', txt:'Unselect All', events:{click:()=>{
                    const checkBoxes = container.querySelectorAll('input[type=checkbox]');
                    for (let i=0; i<checkBoxes.length; ++i) {
                        const checkbox = checkBoxes[i] as HTMLInputElement;
                        checkbox.checked=false;
                    }
                    updateButton();
                }}},
            ]
        });

        for (const character of json) {
            const characterElement = ChooseCharactersDlg.createElementforCharacter(character, updateButton);
            ChooseCharactersDlg.addElementForCharacter(character, container, characterElement);
        }

        return await this.baseOpen(
            document.activeElement,
            'importOfficial',
            [
                {t:'h1', txt:'Choose character(s) to import'},
                filterRow,
                container
            ],
            [{label:'Import 0 Characters', id:'importButton', callback:doImport, disabled:true}, {label:'Cancel'}]
        )??[];
    }

    /** create the row for hte given entry */
    protected static createElementforCharacter(scriptEntry:ScriptEntry, updateCb:()=>void):HTMLElement {
        if ('ability' in scriptEntry) {
            const element = createElement({
                t:'div',
                css:['importCharacter'],
                a:{title:scriptEntry.ability??'', 'data-id':scriptEntry.id},
                children:[
                    {t:'input', a:{type:'checkbox', 'data-id':scriptEntry.id}, id:`${scriptEntry.id}-checkbox`, events:{change:updateCb}},
                    {t:'label', a:{for:`${scriptEntry.id}-checkbox`}, txt:scriptEntry.name}
                ]
            });
            setTeamColorStyle(parseBloodTeam(scriptEntry.team ?? ''), element.classList);
            return element;
        }

        // must be a meta entry
        return createElement({
            t:'div',
            css:['importCharacter'],
            a:{title:'Meta information about the custom script, such as name, author, and logo.', 'data-id':scriptEntry.id},
            children:[
                {t:'input', a:{type:'checkbox', 'data-id':scriptEntry.id}, id:`${scriptEntry.id}-checkbox`, events:{change:updateCb}},
                {t:'label', a:{for:`${scriptEntry.id}-checkbox`}, txt:`Meta (Name, Author, Edition Logo, etc.)`}
            ]
        });
    }
}

/**
 * hide characters who don't pass the filter
 */
function doFilter(filterString:string, characters:Map<string, ScriptEntry>, element:HTMLElement):void {
    const {id} = element.dataset;
    if (!id) {return;}
    const character = characters.get(id);
    if (!character) {return;}
    if (passesFilter(filterString, character)) {
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
    }
}

/** test a character against the filter */
function passesFilter(filterString:string, entry:ScriptEntry):boolean {
    if (!filterString) {return true;}
    const loweredFilterString = filterString.toLowerCase();
    for (const haystack of Object.values(entry)) {
        if (typeof haystack === 'string') {
            if (haystack.toLowerCase().includes(loweredFilterString)) {return true;}
        }
    }
    return false;
}
