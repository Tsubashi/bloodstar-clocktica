/**
 * Base definitions from which bindings are built
 *
 * @module BaseBinding
 */

export type PropertyChangeListener<T> = (value:T)=>Promise<void>|void;

export type DisplayValuePair<ValueType> = {display:string; value:ValueType};
export type DisplayValuePairs<ValueType> = readonly DisplayValuePair<ValueType>[];

/** generic observable property */
export class Property<T> {
    private defaultValue:T;

    private value:T;

    private listeners:PropertyChangeListener<T>[];

    constructor(value:T) {
        this.defaultValue = value;
        this.value = value;
        this.listeners = [];
    }

    async set(value:T):Promise<void> {
        if (this.value !== value) {
            this.value = value;
            await this.notifyListeners();
        }
    }

    get():T {
        return this.value;
    }

    addListener(cb:PropertyChangeListener<T>):void {
        this.listeners.push(cb);
    }

    getDefault():T {return this.defaultValue;}

    isDefault():boolean { return this.value === this.defaultValue; }

    removeListener(cb:PropertyChangeListener<T>):void {
        this.listeners = this.listeners.filter(i=>i!==cb);
    }

    removeAllListeners():void {
        this.listeners = [];
    }

    async reset():Promise<void> {
        await this.set(this.defaultValue);
    }

    private async notifyListeners():Promise<void> {
        await Promise.all(this.listeners.map(cb=>cb(this.value)));
    }
}

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

export type SyncFromElementToPropertyFn = ((e:Event)=>Promise<void>)|null;
export type SyncFromPropertyToElementFn<ValueType> = ((v:ValueType)=>Promise<void>) | null;

/** shared code between binding classes */
export class BaseBinding<ValueType> {
    private htmlElement:HTMLElement;

    private property:Property<ValueType>;

    private eventName:string;

    private syncFromElementToProperty:SyncFromElementToPropertyFn;

    private syncFromPropertyToElement:SyncFromPropertyToElementFn<ValueType>;

    /** set up the binding and bookkeeping for cleanup */
    protected constructor(
        element:HTMLElement,
        property:Property<ValueType>,
        eventName:string,
        syncFromElementToProperty:SyncFromElementToPropertyFn,
        syncFromPropertyToElement:SyncFromPropertyToElementFn<ValueType>
    ) {
        this.htmlElement = element;
        this.property = property;
        this.eventName = eventName;

        this.syncFromElementToProperty = syncFromElementToProperty;
        this.syncFromPropertyToElement = syncFromPropertyToElement;
    }

    /** clean up */
    destroy():void {
        if (this.syncFromElementToProperty) {
            this.htmlElement.removeEventListener(this.eventName, this.syncFromElementToProperty);
            this.syncFromElementToProperty = null;
        }
        if (this.syncFromPropertyToElement) {
            this.property.removeListener(this.syncFromPropertyToElement);
            this.syncFromPropertyToElement = null;
        }
    }

    protected getProperty():Property<ValueType>|null {
        return this.property;
    }

    /** asynchronous initialization */
    protected async init():Promise<void> {
        if (this.syncFromPropertyToElement) { await this.syncFromPropertyToElement(this.property.get()); }

        if (this.syncFromElementToProperty) {
            this.htmlElement.addEventListener(this.eventName, this.syncFromElementToProperty);
        }
        if (this.syncFromPropertyToElement) {
            this.property.addListener(this.syncFromPropertyToElement);
        }
    }
}