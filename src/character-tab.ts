/**
 * code for character tab
 * @module CharacterTab
 */
import {
    bindCheckboxById,
    bindComboBoxById,
    bindImageChooserById,
    bindImageDisplayById,
    bindSliderById,
    bindStyleById,
    bindTextById,
    bindVisibilityById,
    EnumProperty,
    Property,
    unbindElementById
} from './bind/bindings';
import {showErrorNoWait} from "./dlg/blood-message-dlg";
import { ProcessImageSettings } from './blood-image';
import { BloodTeam, parseBloodTeam } from './model/blood-team';
import { parseSpecial } from './model/special';
import { Character } from './model/character';
import {hookupClickEvents} from './util';
import { setTeamColorStyle } from './team-color';

/** helper type for disableCharacterTab */
type TagsThatCanBeDisabled = "button" | "fieldset" | "input" | "optgroup" | "option" | "select" | "textarea";
const tagsThatCanBeDisabled:readonly TagsThatCanBeDisabled[] = ['button', 'fieldset', 'optgroup', 'option', 'select', 'textarea', 'input'];

/** set up character tab bindings. returns the cleanup function */
async function bindCharacterTabControls(character:Character):Promise<()=>Promise<void>> {
    const characterTabIds:Set<string> = new Set<string>();
    await bindTrackedText('characterId', character.id, characterTabIds);
    await bindTrackedText('characterName', character.name, characterTabIds);
    await bindTrackedComboBox('characterTeam', character.team, characterTabIds, parseBloodTeam, x=>x);
    await bindTrackedStyle<BloodTeam>('characterTeam', character.team, setTeamColorStyle, characterTabIds);
    await bindTrackedText('characterAbility', character.ability, characterTabIds);
    await bindTrackedComboBox('characterSpecial', character.special, characterTabIds, parseSpecial, x=>x);
    await bindTrackedText('characterFirstNightReminder', character.firstNightReminder, characterTabIds);
    await bindTrackedText('characterOtherNightReminder', character.otherNightReminder, characterTabIds);
    await bindTrackedCheckBox('characterSetup', character.setup, characterTabIds);
    await bindTrackedText('characterReminderTokens', character.characterReminderTokens, characterTabIds);
    await bindTrackedText('globalReminderTokens', character.globalReminderTokens, characterTabIds);
    await bindTrackedCheckBox('characterExport', character.export, characterTabIds);
    await bindTrackedText('characterNotes', character.notes, characterTabIds);
    await bindTrackedText('characterAttribution', character.attribution, characterTabIds);
    await bindTrackedText('characterAlmanacFlavor', character.almanac.flavor, characterTabIds);
    await bindTrackedText('characterAlmanacOverview', character.almanac.overview, characterTabIds);
    await bindTrackedText('characterAlmanacExamples', character.almanac.examples, characterTabIds);
    await bindTrackedText('characterAlmanacHowToRun', character.almanac.howToRun, characterTabIds);
    await bindTrackedText('characterAlmanacTip', character.almanac.tip, characterTabIds);
    await bindTrackedImageChooser('characterUnstyledImageInput', character.unStyledImage, characterTabIds);
    await bindTrackedVisibility('characterImagePreviewSpinner', character.isLoading, characterTabIds);
    await bindTrackedImageDisplay('characterStyledImageDisplay', character.styledImage, characterTabIds);

    await bindTrackedText('curvedCharacterNameTextPath', character.name, characterTabIds);

    const sliderHelper = async (id:string, p:Property<number>) => bindTrackedSlider(id, `${id}ValueLabel`, p, characterTabIds);

    await bindTrackedCheckBox('shouldRestyle', character.imageSettings.shouldRestyle, characterTabIds);
    await sliderHelper('horizontalPlacement', character.imageSettings.horizontalPlacement);
    await sliderHelper('verticalPlacement', character.imageSettings.verticalPlacement);
    await sliderHelper('sizeFactor', character.imageSettings.sizeFactor);
    await bindTrackedCheckBox('shouldCrop', character.imageSettings.shouldCrop, characterTabIds);
    await bindTrackedCheckBox('shouldColorize', character.imageSettings.shouldColorize, characterTabIds);
    await bindTrackedCheckBox('useOutsiderAndMinionColors', character.imageSettings.useOutsiderAndMinionColors, characterTabIds);
    await bindTrackedCheckBox('useTexture', character.imageSettings.useTexture, characterTabIds);
    await bindTrackedCheckBox('useBorder', character.imageSettings.useBorder, characterTabIds);
    await sliderHelper('borderIntensity', character.imageSettings.borderIntensity);
    await bindTrackedCheckBox('dropShadow', character.imageSettings.useDropshadow, characterTabIds);
    await sliderHelper('dropShadowSize', character.imageSettings.dropShadowSize);
    await sliderHelper('dropShadowOffsetX', character.imageSettings.dropShadowOffsetX);
    await sliderHelper('dropShadowOffsetY', character.imageSettings.dropShadowOffsetY);
    await sliderHelper('dropShadowOpacity', character.imageSettings.dropShadowOpacity);

    const unhookupClickEvents = hookupClickEvents([
        ['characterImageRemoveBtn', async ()=>character.unStyledImage.set(null)],
        ['resetImageSettings', async ()=>character.imageSettings.reset()]
    ]);

    if (unbindCharacterTabControls) {
        const message = 'binding character tab controls without clearing previous bindings';
        showErrorNoWait('Programmer Error', message, new Error(message));
    }

    return async () => {
        unhookupClickEvents();

        const promises = [];
        for (const id of characterTabIds) {
            promises.push(unbindElementById(id));
        }
        await Promise.all(promises);
    };
}

/** helper for bindCharacterTabControls */
async function bindTrackedCheckBox(id:string, property:Property<boolean>, set:Set<string>):Promise<void> {
    set.add(id);
    await bindCheckboxById(id, property);
}

/** helper for bindCharacterTabControls */
async function bindTrackedComboBox<ValueType>(
    id:string, property:EnumProperty<ValueType>,
    set:Set<string>,
    stringToEnum:(s:string)=>ValueType,
    enumToString:(t:ValueType)=>string
):Promise<void> {
    set.add(id);
    await bindComboBoxById<ValueType>(id, property, stringToEnum, enumToString);
}
/** helper for bindCharacterTabControls */
async function bindTrackedImageChooser(id:string, property:Property<string|null>, set:Set<string>):Promise<void> {
    set.add(id);
    await bindImageChooserById(id, property, ProcessImageSettings.FULL_WIDTH, ProcessImageSettings.FULL_HEIGHT);
}

/** helper for bindCharacterTabControls */
async function bindTrackedImageDisplay(id:string, property:Property<string|null>, set:Set<string>):Promise<void> {
    set.add(id);
    await bindImageDisplayById(id, property);
}

/** helper for bindCharacterTabControls */
async function bindTrackedSlider(id:string, valueLabelId:string|null, property:Property<number>, set:Set<string>):Promise<void> {
    set.add(id);
    await bindSliderById(id, valueLabelId, property);
}

/** helper for bindCharacterTabControls */
async function bindTrackedStyle<ValueType>(id:string, property:Property<ValueType>, cb:(value:ValueType, classList:DOMTokenList)=>void, set:Set<string>):Promise<void> {
    set.add(id);
    await bindStyleById<ValueType>(id, property, cb);
}

/** helper for bindCharacterTabControls */
async function bindTrackedText(id:string, property:Property<string>, set:Set<string>):Promise<void> {
    set.add(id);
    await bindTextById(id, property);
}

/** helper for bindCharacterTabControls */
async function bindTrackedVisibility(id:string, property:Property<boolean>, set:Set<string>):Promise<void> {
    set.add(id);
    await bindVisibilityById(id, property);
}

/** make the entire character tab disabled */
function disableCharacterTab():void {
    const tabDiv = document.getElementById('charactertab');
    if (!tabDiv) { return; }
    for (const tag of tagsThatCanBeDisabled) {
        const elements = tabDiv.getElementsByTagName(tag);
        for (let i=0; i<elements.length; i++) {
            const item = elements.item(i);
            if (item) {
                item.disabled = true;
            }
        }
    }
}

/** undo disableCharacterTab */
function enableCharacterTab():void {
    const tabDiv = document.getElementById('charactertab');
    if (!tabDiv) { return; }
    for (const tag of tagsThatCanBeDisabled) {
        const elements = tabDiv.getElementsByTagName(tag);
        for (let i=0; i<elements.length; i++) {
            const item = elements.item(i);
            if (item) {
                item.disabled = false;
            }
        }
    }
}

/** update character tab to show this character */
export async function setSelectedCharacter(value:Character|null):Promise<void> {
    if (unbindCharacterTabControls) {unbindCharacterTabControls();}
    unbindCharacterTabControls = null;
    if (value) {
        unbindCharacterTabControls = await bindCharacterTabControls(value);
        enableCharacterTab();
    } else {
        disableCharacterTab();
    }
}

/** returned by bindCharacterTabControls, used to undo what it did */
let unbindCharacterTabControls:(()=>void)|null = null;