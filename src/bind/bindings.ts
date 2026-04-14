/* eslint-disable @typescript-eslint/no-explicit-any */
import {BaseBinding, Property, PropertyChangeListener} from './base-binding';
import AttributeBinding from './attribute-binding';
import {CollectionBinding, CollectionBindingOptions} from './collection-binding';
import {ImageChooserBinding, ImageDisplayBinding} from './image-binding';
import SliderBinding from './slider-binding';
import {StyleBinding} from './style-binding';
import {VisibilityBinding} from './visibility-binding';
import {ObservableCollection} from './observable-collection';
import {ObservableObject} from './observable-object';

export type DisplayValuePair<ValueType> = {display:string; value:ValueType};
export type DisplayValuePairs<ValueType> = readonly DisplayValuePair<ValueType>[];

/** observable property for an enum/select element */
export class EnumProperty<ValueType> extends Property<ValueType> {
    private options:DisplayValuePairs<ValueType>;

    constructor(value:ValueType, displayValuePairs:DisplayValuePairs<ValueType>) {
        super(value);
        this.options = displayValuePairs;
    }

    /** get the display string for the current value */
    getDisplay():string {
        const myValue = this.get();
        for (const {display, value} of this.options) {
            if (value === myValue) {
                return display;
            }
        }
        return '';
    }

    /** get the {display,value} pairs for the enum options */
    getOptions():DisplayValuePairs<ValueType> { return this.options; }
}

/** central authority on bindings */
const bindings = new Map<Node, Binding[]>();

type Binding = BaseBinding<any> | CollectionBinding<any>;

/** bindings for a checkbox */
class CheckboxBinding extends BaseBinding<boolean> {
    /** create an instance asynchronously */
    static async create(element:HTMLInputElement, property:Property<boolean>) {
        const self = new CheckboxBinding(element, property, 'change', async ()=>property.set(element.checked), async v=>{element.checked=v;});
        await self.init();
        return self;
    }
}

/** binding between a label, input text, ot text area element and a string property */
class TextBinding extends BaseBinding<string> {
    /** create an instance asynchronously */
    static async create(element:HTMLElement, property:Property<string>) {
        const isText = (element instanceof HTMLTextAreaElement) || (element instanceof HTMLInputElement);
        const eventName = isText ? 'input' : '';
        const syncFromElementToProperty = isText ? async ()=>property.set(element.value) : null;
        const syncFromPropertyToElement = isText ?
            async (v:string)=>{
                element.value=v;
                element.dispatchEvent(new Event('change'));
                element.dispatchEvent(new Event('input'));
            } :
            async (v:string)=>{element.textContent=v;};
        const self = new TextBinding(element, property, eventName, syncFromElementToProperty, syncFromPropertyToElement);
        await self.init();
        return self;
    }
}

/** binding between a label, input text, ot text area element and a string property, showing the display string rather the value */
class TextEnumBinding extends BaseBinding<any> {
    /** create an instance asynchronously */
    static async create(element:HTMLElement, property:EnumProperty<any>) {
        const isText = (element instanceof HTMLTextAreaElement) || (element instanceof HTMLInputElement);
        const eventName = isText ? 'input' : '';
        const syncFromPropertyToElement = isText ?
            async ()=>{element.value=property.getDisplay();} :
            async ()=>{element.innerText=property.getDisplay();};
        const self = new TextEnumBinding(element, property, eventName, null, syncFromPropertyToElement);
        await self.init();
        return self;
    }
}

/** bindings for a ComboBox and EnumProperty */
class ComboBoxBinding<T> extends BaseBinding<T> {
    private constructor(element:HTMLSelectElement, property:EnumProperty<T>, stringToEnum:(s:string)=>T, enumToString:(t:T)=>string) {
        element.innerText = '';
        property.getOptions().forEach(data => {
            const {display, value} = data;
            const optionElement = document.createElement('option');
            optionElement.value = String(value);
            optionElement.innerText = display;
            element.appendChild(optionElement);
        });

        const syncFromElementToProperty = async ()=>property.set(stringToEnum(element.value));
        const syncFromPropertyToElement = async (value:T)=>{element.value=enumToString(value);};
        super(element, property, 'change', syncFromElementToProperty, syncFromPropertyToElement);
    }

    /** create an instance asynchronously */
    static async createComboBoxBinding<T>(element:HTMLSelectElement, property:EnumProperty<T>, stringToEnum:(s:string)=>T, enumToString:(t:T)=>string) {
        const self = new ComboBoxBinding<T>(element, property, stringToEnum, enumToString);
        await self.init();
        return self;
    }
}

/** add a binding for the given element to be later cleaned up with unbindElement */
function addBinding(element:Node, binding:Binding):void {
    let bindingsForElement = bindings.get(element);
    if (!bindingsForElement) {
        bindingsForElement = [];
        bindings.set(element, bindingsForElement);
    }
    bindingsForElement.push(binding);
}

/** ONE WAY. bind a string property to an element attribute */
export async function bindAttribute(element:HTMLElement, attributeName:string, property:Property<string>):Promise<void> {
    const binding = await AttributeBinding.create(element, attributeName, property);
    addBinding(element, binding);
}

/** bind checkbox to some data */
export async function bindCheckbox(checkboxElement:HTMLInputElement, boolProperty:Property<boolean>):Promise<void> {
    const binding = await CheckboxBinding.create(checkboxElement, boolProperty);
    addBinding(checkboxElement, binding);
}

/** bind checkbox to some data */
export async function bindCheckboxById(id:string, boolProperty:Property<boolean>):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof HTMLInputElement) {
        return bindCheckbox(element, boolProperty);
    }
    return Promise.resolve();
}

/** bind ComboBox to EnumProperty */
export async function bindComboBox<ValueType>(
    selectElement:HTMLSelectElement,
    enumProperty:EnumProperty<ValueType>,
    stringToEnum:(s:string)=>ValueType,
    enumToString:(t:ValueType)=>string
):Promise<void> {
    const binding = await ComboBoxBinding.createComboBoxBinding<ValueType>(selectElement, enumProperty, stringToEnum, enumToString);
    addBinding(selectElement, binding);
}

/** bind ComboBox to EnumProperty */
export async function bindComboBoxById<ValueType>(
    id:string,
    enumProperty:EnumProperty<ValueType>,
    stringToEnum:(s:string)=>ValueType,
    enumToString:(t:ValueType)=>string
):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof HTMLSelectElement) {
        return bindComboBox<ValueType>(element, enumProperty, stringToEnum, enumToString);
    }
    return Promise.resolve();
}

/** bind a string property to a label, input text, text area, or even SVG element */
export async function bindText(element:HTMLElement, property:Property<string>):Promise<void> {
    const binding = await TextBinding.create(element, property);
    addBinding(element, binding);
}

/** bind a string property to a label, input text, or text area element */
export async function bindTextById(id:string, property:Property<string>):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof Node) {
        return bindText(element, property);
    }
    return Promise.resolve();
}

/** bind a number property to a input[type=range] element */
export async function bindSlider(element:HTMLInputElement, valueLabel:HTMLElement|null, property:Property<number>):Promise<void> {
    const binding = await SliderBinding.create(element, valueLabel, property);
    addBinding(element, binding);
}

/** bind a number property to a input[type=range] element */
export async function bindSliderById(id:string, valueLabelId:string|null, property:Property<number>):Promise<void> {
    const element = document.getElementById(id);
    const valueLabel = (valueLabelId===null)?null:document.getElementById(valueLabelId);
    if (element instanceof HTMLInputElement) {
        return bindSlider(element, valueLabel, property);
    }
    return Promise.resolve();
}

/** bind an enumproperty to a label, input text, or text area element, showing the display name of the value rather than the value */
export async function bindEnumDisplay(element:HTMLElement, property:EnumProperty<any>):Promise<void> {
    const binding = await TextEnumBinding.create(element, property);
    addBinding(element, binding);
}

/** bind an enumproperty to a label, input text, or text area element, showing the display name of the value rather than the value */
export async function bindEnumDisplayById(id:string, property:EnumProperty<string>):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof HTMLElement) {
        return bindEnumDisplay(element, property);
    }
    return Promise.resolve();
}

/** bind a collection of items, and callbacks to create/destroy/update items to a parent element */
export async function bindCollection<T extends ObservableObject<T>>(
    element:HTMLOListElement,
    collection:ObservableCollection<T>,
    options?:CollectionBindingOptions<T>
):Promise<void> {
    addBinding(element, await CollectionBinding.create<T>(element, collection, options));
}

/** bind a collection of items, and callbacks to create/destroy/update items to a parent element */
export async function bindCollectionById<T extends ObservableObject<T>>(
    id:string,
    collection:ObservableCollection<T>,
    options?:CollectionBindingOptions<T>
):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof HTMLOListElement) {
        return bindCollection(element, collection, options);
    }
    return Promise.resolve();
}

/** bind an image to a `string|null` property that stores an object url */
export async function bindImageDisplay(element:HTMLImageElement, property:Property<string|null>):Promise<void> {
    const binding = await ImageDisplayBinding.create(element, property);
    addBinding(element, binding);
}

/** bind an image to a `string|null` property that stores an object url */
export async function bindImageDisplayById(id:string, property:Property<string|null>):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof HTMLImageElement) {
        return bindImageDisplay(element, property);
    }
    return Promise.resolve();
}

/** bind an `input[type=file]` element to a `string|null` property that stores an object url */
export async function bindImageChooser(element:HTMLInputElement, property:Property<string|null>, maxWidth:number, maxHeight:number):Promise<void> {
    const binding = await ImageChooserBinding.create(element, property, maxWidth, maxHeight);
    addBinding(element, binding);
}

/** bind an `input[type=file] to a `string|null` property that stores an object url */
export async function bindImageChooserById(id:string, property:Property<string|null>, maxWidth:number, maxHeight:number):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof HTMLInputElement) {
        return bindImageChooser(element, property, maxWidth, maxHeight);
    }
    return Promise.resolve();
}

/** one way binding. automatically add or remove a css class based on the property value and callback */
export async function bindStyle<ValueType>(element:HTMLElement, property:Property<ValueType>, cb:(value:ValueType, classList:DOMTokenList)=>void):Promise<void> {
    const binding = await StyleBinding.create(element, property, cb);
    addBinding(element, binding);
}

/** one way binding. automatically add or remove a css class based on the property value and callback */
export async function bindStyleById<ValueType>(id:string, property:Property<ValueType>, cb:(value:ValueType, classList:DOMTokenList)=>void):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof HTMLElement) {
        return bindStyle(element, property, cb);
    }
    return Promise.resolve();
}

/** one-way binding. make the element visible or not based on a boolean property */
export async function bindVisibility(element:HTMLElement, property:Property<boolean>):Promise<void> {
    const binding = await VisibilityBinding.create(element, property);
    addBinding(element, binding);
}

/** one-way binding. make the element visible or not based on a boolean property */
export async function bindVisibilityById(id:string, property:Property<boolean>):Promise<void> {
    const element = document.getElementById(id);
    if (element instanceof HTMLElement) {
        return bindVisibility(element, property);
    }
    return Promise.resolve();
}

/** clear element's current binding, if any */
export async function unbindElement(element:Node):Promise<void> {
    const bindingsForElement = bindings.get(element);
    if (!bindingsForElement) {return;}
    for (const binding of bindingsForElement) {
        await binding.destroy();
    }
    bindings.delete(element);
}

/** clear element's current binding, if any */
export async function unbindElementById(id:string):Promise<void> {
    const element = document.getElementById(id);
    if (!element) {return Promise.resolve();}
    return unbindElement(element);
}

// re-export
export {Property, PropertyChangeListener};