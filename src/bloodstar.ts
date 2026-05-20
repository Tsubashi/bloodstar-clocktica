import * as BloodBind from './bind/bindings';
import * as BloodNewOpen from "./dlg/blood-new-open-dlg";
import {showErrorNoWait} from "./dlg/blood-message-dlg";
import {Character} from "./model/character";
import {Edition} from "./model/edition";
import {initNightOrderBindings} from './night-order';
import {hookupClickEvents} from './util';
import * as CharacterTab from './character-tab';
import { ProcessImageSettings } from './blood-image';
import Images from './images';
import { bindCharacterList } from './character-list';
import { BloodTeam } from './model/blood-team';
import {signIn} from './sign-in';
import menuInit, { updateUserDisplay } from './menu';
import {save} from './commands/save';
import {clearRecentFile, getRecentFile} from './recent-file';
import {openExisting} from './dlg/open-flow';
import * as StateHistory from './state-history';
import './styles/autogrowtextarea.css';
import './styles/characterlist.css';
import './styles/charactertab.css';
import './styles/dialog.css';
import './styles/dragdrop.css';
import './styles/main.css';
import './styles/menu.css';
import './styles/nightorder.css';
import './styles/scrollbars.css';
import './styles/slider.css';
import './styles/tabs.css';
import './styles/teamcolor.css';

type BloodstarOptions = {
    mobile?:boolean;
};

let bloodstarOptions:BloodstarOptions = {};

export const selectedCharacter = new BloodBind.Property<Character|null>(null);

/** check whether this is the mobile version of the site */
export function isMobile():boolean {
    return bloodstarOptions.mobile??false;
}

/**
 * switch to a tab
 */
export async function tabClicked(btnId:string, tabId:string):Promise<void> {
    // if you clicked the current tab, nevermind
    const clickedTabBtn = document.getElementById(btnId);
    if (clickedTabBtn?.classList.contains('selectedTabBtn')) {
        return;
    }

    // stop whatever special state you were in
    await StateHistory.clear();

    const allTabBtns = document.getElementsByClassName("tabButton");
    for (let i = 0; i < allTabBtns.length; i++) {
        const tabBtn = allTabBtns[i];
        tabBtn.classList.remove('selectedTabBtn');
    }

    const allTabs = document.getElementsByClassName("tab");
    for (let i = 0; i < allTabs.length; i++) {
        const tabBtn = allTabs[i];
        tabBtn.classList.remove('activeTab');
    }

    if (clickedTabBtn) {
        clickedTabBtn.classList.add('selectedTabBtn');
    }

    const tabDiv = document.getElementById(tabId);
    if (tabDiv) {
        tabDiv.classList.add('activeTab');
    }
}

/** initialize listeners and data bindings */
async function initBindings(edition:Edition):Promise<void> {
    window.addEventListener('beforeunload', (event):string|undefined=>{
        if (!edition.dirty.get()) {return undefined;}
        event.preventDefault();
        const message = "Are you sure you want to leave? Unsaved changes will be lost.";
        event.returnValue = message;
        return message;
    });

    document.addEventListener('keydown', async (e) => {
        if (e.ctrlKey) {
            if (e.code === "KeyS") {
                e.preventDefault();
                await save(edition);
            }
        }
    });
    hookupClickEvents([
        ['metaTabBtn', async ()=>tabClicked('metaTabBtn', 'metatab')],
        ['charTabBtn', async ()=>tabClicked('charTabBtn', 'charactertab')],
        ['firstNightTabBtn', async ()=>tabClicked('firstNightTabBtn', 'firstNightOrderTab')],
        ['otherNightTabBtn', async ()=>tabClicked('otherNightTabBtn', 'otherNightOrderTab')],
        ['metaLogoRemoveBtn', async ()=>edition.meta.logo.set(null)],
    ]);

    const promises = [];

    promises.push(BloodBind.bindTextById('windowTitle', edition.windowTitle));
    promises.push(BloodBind.bindTextById('metaName', edition.meta.name));
    promises.push(BloodBind.bindTextById('metaAuthor', edition.meta.author));
    promises.push(BloodBind.bindTextById('metaSynopsis', edition.almanac.synopsis));
    promises.push(BloodBind.bindTextById('metaOverview', edition.almanac.overview));
    promises.push(BloodBind.bindTextById('metaChangeLog', edition.almanac.changelog));
    promises.push(BloodBind.bindImageChooserById('metaLogoInput', edition.meta.logo, ProcessImageSettings.FULL_WIDTH, ProcessImageSettings.FULL_HEIGHT));
    promises.push(BloodBind.bindImageDisplayById('metaLogoDisplay', edition.meta.logo));

    const tokenBackground = document.getElementById('tokenBackground');
    if (tokenBackground instanceof HTMLImageElement) {
        tokenBackground.src = Images.TOKEN_URL;
        promises.push(BloodBind.bindVisibility(tokenBackground, edition.previewOnToken));
    }
    const curvedCharacterText = document.getElementById('curvedCharacterNameHolder');
    if (curvedCharacterText) {
        promises.push(BloodBind.bindVisibility(curvedCharacterText, edition.previewOnToken));
    }

    promises.push(bindCharacterList('characterList', edition.characterList, selectedCharacter));

    promises.push(initNightOrderBindings(edition, selectedCharacter));

    // tie selected character to character tab
    selectedCharacter.addListener(async v=>{
        await CharacterTab.setSelectedCharacter(v);
        if (!isMobile()) {
            if (v) {
                return tabClicked('charTabBtn', 'charactertab');
            }
        }
        return Promise.resolve();
    });

    promises.push(BloodBind.bindCheckboxById('previewOnToken', edition.previewOnToken));

    edition.addPropertyChangedEventListener(key => {
        if (key === 'characterList') {
            updateStatusbar(edition);
        }
    });
    updateStatusbar(edition);

    await Promise.all(promises);
    await selectedCharacter.set(edition.characterList.get(0));
}

/** initialize CustomEdition object to bind to */
async function initCustomEdition(edition:Edition, email?:string):Promise<void> {
    try {
        const rememberedFile = email?getRecentFile(email):'';
        if (rememberedFile) {
            if (await openExisting(edition, rememberedFile)) {
                return;
            }
            clearRecentFile(rememberedFile);
        }

        // eslint-disable-next-line no-empty
        while (!await BloodNewOpen.show(edition)) {
        }
    } catch (e: unknown) {
        await edition.reset();
        showErrorNoWait('Error', 'Error encountered during initialization', e);
    }
}

/** prepare app */
async function _init(options?:BloodstarOptions) {
    bloodstarOptions = options??{};

    const edition = await Edition.asyncNew();

    await initBindings(edition);

    menuInit(edition);

    updateUserDisplay(null);
    const sessionInfo = await signIn({cancelLabel:'Continue as Guest'});

    await initCustomEdition(edition, sessionInfo?.email);

    if (isMobile()) {
        await tabClicked('charTabBtn', 'charactertab');
    }
}

type StatusBarData = Map<string, {id:string; exported:number; total:number}>;

/** update status bar text */
function collectStatusBarData(edition:Edition):StatusBarData {
    const data:StatusBarData = new Map();
    data.set('all', {id:'charactersStatus', exported:0, total:0});
    data.set(BloodTeam.TOWNSFOLK, {id:'townsfolkStatus', exported:0, total:0});
    data.set(BloodTeam.OUTSIDER, {id:'outsidersStatus', exported:0, total:0});
    data.set(BloodTeam.MINION, {id:'minionsStatus', exported:0, total:0});
    data.set(BloodTeam.DEMON, {id:'demonsStatus', exported:0, total:0});
    data.set(BloodTeam.TRAVELLER, {id:'travellersStatus', exported:0, total:0});
    data.set(BloodTeam.FABLED, {id:'fabledStatus', exported:0, total:0});
    data.set(BloodTeam.JINXES, {id:'jinxesStatus', exported:0, total:0});
    data.set(BloodTeam.LORIC, {id:'loricStatus', exported:0, total:0});
    for (const character of edition.characterList) {
        const exported = character.export.get();
        for (const teamKey of ['all', character.team.get()]) {
            const teamData = data.get(teamKey);
            if (!teamData) {continue;}
            teamData.total++;
            if (exported) {
                teamData.exported++;
            }
        }
    }
    return data;
}

/** update status bar text */
function updateStatusbar(edition:Edition):void {
    for (const {id, exported, total} of collectStatusBarData(edition).values()) {
        const element = document.getElementById(id);
        if (element) {
            element.innerText = `${exported}/${total}`;
        }
    }
}

export async function init(options?:BloodstarOptions):Promise<void> {
    return new Promise((resolve)=>{
        // wait for dom to load
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", async ()=>{
                await init();
                resolve();
            });
        } else {
            // `DOMContentLoaded` already fired

            // intentional floating promise
            // eslint-disable-next-line @typescript-eslint/no-floating-promises
            _init(options).then(resolve);
        }
    });
}

