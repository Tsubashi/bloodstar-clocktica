/* eslint-disable @typescript-eslint/no-explicit-any */
import { DisplayValuePairs, EnumProperty, Property } from "./bindings";
import { ObservableCollection } from "./observable-collection";

export type PropKey<T> = string & keyof T;
export type ObservableType = ObservableCollection<any>|ObservableObject<any>|Property<any>;
export type CustomSerializeFn = (object:ObservableObject<any>, field:ObservableType)=>unknown;
export type CustomDeserializeFn = (object:ObservableObject<any>, field:ObservableType, data:unknown)=>Promise<void>;
export type PropertyCfg = {
    /** if set to false, the field is ignored during deserialization */
    read?:boolean;
    /** if set to false, the field is ignored during serialization */
    write?:boolean;
    /** if set to false, changes to the field do not send property changed events */
    notify?:boolean;
    /** if set to true, changes to the field are serialized even if it is the default value */
    saveDefault?:boolean;
    /** if set, this is used to convert the value before serializing */
    customSerialize?:CustomSerializeFn;
    /** if set, this is used to set the value when deserializing */
    customDeserialize?:CustomDeserializeFn;
};
export type PropertyChangedListener<T> = (propName:PropKey<T>) => Promise<void>|void;

function noSuchProperty<T>(object:any, key:PropKey<T>):never {
    const message = `no property '${String(key)}' on object (${object.constructor.name})`;
    const error = new Error(message);
    console.error('Error', message, error);
    throw error;
}

type PropertyEntry = {defaultValue:unknown};
type EnumPropertyEntry = {
    defaultValue:unknown;
    displayValuePairs: DisplayValuePairs<unknown>;
};
type CollectionEntry = {
    ctor:()=>Promise<unknown>;
};
type ChildEntry = {
    ctor:new ()=>ObservableObject<unknown>;
};

class ObservableObjectConfig {
    properties = new Map<string|symbol, PropertyEntry>();

    enumProperties = new Map<string|symbol, EnumPropertyEntry>();

    collections = new Map<string|symbol, CollectionEntry>();

    children = new Map<string|symbol, ChildEntry>();

    exceptions = new Map<string|symbol, PropertyCfg>();
}

const observableObjectData = new Map<any, ObservableObjectConfig>();

/** decorator to make the ObservableObject manage a property */
export function observableProperty(defaultValue:unknown, cfg?:PropertyCfg):PropertyDecorator {
    return (prototype:any, propertyKey:string|symbol):void => {
        let objectEntry = observableObjectData.get(prototype);
        if (!objectEntry) {
            objectEntry = new ObservableObjectConfig();
            observableObjectData.set(prototype, objectEntry);
        }
        objectEntry.properties.set(propertyKey, {defaultValue});
        if (cfg) { objectEntry.exceptions.set(propertyKey, cfg); }
    };
}
/** decorator to make the ObservableObject manage a property */
export function observableEnumProperty<T>(defaultValue:T, displayValuePairs: DisplayValuePairs<unknown>, cfg?:PropertyCfg):PropertyDecorator {
    return (prototype:any, propertyKey:string|symbol):void => {
        let objectEntry = observableObjectData.get(prototype);
        if (!objectEntry) {
            objectEntry = new ObservableObjectConfig();
            observableObjectData.set(prototype, objectEntry);
        }
        objectEntry.enumProperties.set(propertyKey, {defaultValue, displayValuePairs});
        if (cfg) { objectEntry.exceptions.set(propertyKey, cfg); }
    };
}
/** decorator to make the ObservableObject manage a property */
export function observableCollection(ctor:()=>Promise<unknown>, cfg?:PropertyCfg):PropertyDecorator {
    return (prototype:any, propertyKey:string|symbol):void => {
        let objectEntry = observableObjectData.get(prototype);
        if (!objectEntry) {
            objectEntry = new ObservableObjectConfig();
            observableObjectData.set(prototype, objectEntry);
        }
        objectEntry.collections.set(propertyKey, {ctor});
        if (cfg) { objectEntry.exceptions.set(propertyKey, cfg); }
    };
}
/** decorator to make the ObservableObject manage a property */
export function observableChild(ctor:new ()=>ObservableObject<any>, cfg?:PropertyCfg):PropertyDecorator {
    return (prototype:any, propertyKey:string|symbol):void => {
        let objectEntry = observableObjectData.get(prototype);
        if (!objectEntry) {
            objectEntry = new ObservableObjectConfig();
            observableObjectData.set(prototype, objectEntry);
        }
        objectEntry.children.set(propertyKey, {ctor});
        if (cfg) { objectEntry.exceptions.set(propertyKey, cfg); }
    };
}

/** extend this to advertise your properties and changes to them */
export abstract class ObservableObject<T> {
    private collections = new Map<PropKey<T>, ObservableCollection<any>>();

    private children = new Map<PropKey<T>, ObservableObject<any>>();

    private properties = new Map<PropKey<T>, Property<unknown>>();

    private enumProperties = new Map<PropKey<T>, Property<unknown>>();

    private propertyChangedListeners:PropertyChangedListener<T>[] = [];

    private obsObjCfg:ObservableObjectConfig|undefined;

    /** set up listening */
    constructor() {
        const prototype = Object.getPrototypeOf(this);
        if (!prototype) {return;}
        this.obsObjCfg = observableObjectData.get(prototype);
        if (!this.obsObjCfg) {return;}

        // properties
        for (const [_key, {defaultValue}] of this.obsObjCfg.properties) {
            const key = _key as PropKey<T>;
            const property = new Property<unknown>(defaultValue);
            (this as any)[key] = property;
            this.properties.set(key, property);
            property.addListener(async ()=>this.notifyPropertyChangedEventListeners(key));
        }
        // enum properties
        for (const [_key, {defaultValue, displayValuePairs}] of this.obsObjCfg.enumProperties) {
            const key = _key as PropKey<T>;
            const enumProperty = new EnumProperty<unknown>(defaultValue, displayValuePairs);
            (this as any)[key] = enumProperty;
            this.enumProperties.set(key, enumProperty);
            enumProperty.addListener(async ()=>this.notifyPropertyChangedEventListeners(key));
        }
        // collections
        for (const [_key, {ctor}] of this.obsObjCfg.collections) {
            const key = _key as PropKey<T>;
            const collection = new ObservableCollection<any>(ctor);
            (this as any)[key] = collection;
            this.collections.set(key, collection);
            collection.addCollectionChangedListener(async ()=>this.notifyPropertyChangedEventListeners(key));
            collection.addItemChangedListener(async ()=>this.notifyPropertyChangedEventListeners(key));
        }
        // children
        for (const [_key, {ctor:Ctor}] of this.obsObjCfg.children) {
            const key = _key as PropKey<T>;
            const child = new Ctor();
            (this as any)[key] = child;
            this.children.set(key, child as ObservableObject<any>);
            child.addPropertyChangedEventListener(async ()=>this.notifyPropertyChangedEventListeners(key));
        }
    }

    /** check for speical behavior for a field */
    private _canNotifyField(key:PropKey<T>):boolean {
        if (!this.obsObjCfg) {return true;}
        const cfg = this.obsObjCfg.exceptions.get(key as string|symbol);
        if (!cfg) {return true;}
        return cfg.notify!==false;
    }

    /** check for speical behavior for a field */
    private _canReadField(key:PropKey<T>):boolean {
        if (!this.obsObjCfg) {return true;}
        const cfg = this.obsObjCfg.exceptions.get(key as string|symbol);
        if (!cfg) {return true;}
        return cfg.read!==false;
    }

    /** check for speical behavior for a field */
    private _canWriteField(key:PropKey<T>):boolean {
        if (!this.obsObjCfg) {return true;}
        const cfg = this.obsObjCfg.exceptions.get(key as string|symbol);
        if (!cfg) {return true;}
        return cfg.write!==false;
    }

    /** check for special behavior for a field */
    private _saveDefault(key:PropKey<T>):boolean {
        if (!this.obsObjCfg) {return false;}
        const cfg = this.obsObjCfg.exceptions.get(key as string|symbol);
        if (!cfg) {return false;}
        return Boolean(cfg.saveDefault);
    }

    /** check for special behavior for a field */
    private _getCustomDeserialize(key:PropKey<T>):CustomDeserializeFn|undefined {
        if (!this.obsObjCfg) {return undefined;}
        const cfg = this.obsObjCfg.exceptions.get(key as string|symbol);
        if (!cfg) {return undefined;}
        return cfg.customDeserialize;
    }

    /** check for speical behavior for a field */
    private _getCustomSerialize(key:PropKey<T>):CustomSerializeFn|undefined {
        if (!this.obsObjCfg) {return undefined;}
        const cfg = this.obsObjCfg.exceptions.get(key as string|symbol);
        if (!cfg) {return undefined;}
        return cfg.customSerialize;
    }

    /** register for updates when a property changes */
    addPropertyChangedEventListener(listener:PropertyChangedListener<T>):void {
        this.propertyChangedListeners.push(listener);
    }

    /** inverse operation from serialize */
    async deserialize(data:Record<string, unknown>):Promise<void> {
        await this.deserializeNonCustom(data);
        await this.deserializeCustom(data);
    }

    /** first pass of deserialization */
    async deserializeNonCustom(data:Record<string, unknown>):Promise<void> {
        await Promise.all([
            this.deserializeNonCustomChildren(data),
            this.deserializeNonCustomCollections(data),
            this.deserializeNonCustomProperties(data)
        ]);
    }

    /** do non-customized deserialization of child observables */
    async deserializeNonCustomChildren(data:Record<string, unknown>):Promise<unknown> {
        const promises = [];
        for (const [key, child] of this.children) {
            if (!this._canReadField(key)) { continue; }
            const childData = data[String(key)] as Record<string, unknown>;
            if ((typeof childData !== 'string') &&
                (typeof childData !== 'number') &&
                (typeof childData !== 'boolean') &&
                !Array.isArray(childData) )
            {
                if (!this._getCustomDeserialize(key)) {
                    promises.push(child.deserialize(childData));
                }
            }
        }
        return Promise.all(promises);
    }

    /** do non-customized deserialization of properties */
    async deserializeNonCustomCollections(data:Record<string, unknown>):Promise<unknown> {
        const promises:Promise<void>[] = [];
        for (const [key, collection] of this.collections) {
            if (!this._canReadField(key)) { continue; }
            const collectionData = data[String(key)];
            if (Array.isArray(collectionData)) {
                if (!this._getCustomDeserialize(key)) {
                    promises.push(collection.deserialize(collectionData));
                }
            }
        }
        return Promise.all(promises);
    }

    /** do non-customized deserialization of properties */
    async deserializeNonCustomProperties(data:Record<string, unknown>):Promise<unknown> {
        const promises = [];
        for (const [key, property] of this.properties) {
            if (!this._canReadField(key)) { continue; }
            const stringKey = String(key);
            const propertyData = Object.prototype.hasOwnProperty.call(data, stringKey) ? data[stringKey] : property.getDefault();
            if (!this._getCustomDeserialize(key)) {
                promises.push(property.set(propertyData));
            }
        }
        for (const [key, property] of this.enumProperties) {
            if (!this._canReadField(key)) { continue; }
            const stringKey = String(key);
            const propertyData = Object.prototype.hasOwnProperty.call(data, stringKey) ? data[stringKey] : property.getDefault();
            if (!this._getCustomDeserialize(key)) {
                promises.push(property.set(propertyData));
            }
        }
        return Promise.all(promises);
    }

    /** second pass of deserialization */
    async deserializeCustom(data:Record<string, unknown>):Promise<void> {
        await Promise.all([
            this.deserializeCustomChildren(data),
            this.deserializeCustomCollections(data),
            this.deserializeCustomProperties(data)
        ]);
    }

    /** do customized deserialization of child observables */
    async deserializeCustomChildren(data:Record<string, unknown>):Promise<unknown> {
        const promises:Promise<void>[] = [];
        for (const [key, child] of this.children) {
            if (!this._canReadField(key)) { continue; }
            const childData = data[String(key)] as Record<string, unknown>;
            if ((typeof childData !== 'string') &&
                (typeof childData !== 'number') &&
                (typeof childData !== 'boolean') &&
                !Array.isArray(childData) )
            {
                const fn = this._getCustomDeserialize(key);
                if (fn) {
                    promises.push(fn(this, child, childData));
                }
            }
        }
        return Promise.all(promises);
    }

    /** do customized deserialization of collections */
    async deserializeCustomCollections(data:Record<string, unknown>):Promise<unknown> {
        const promises:Promise<void>[] = [];
        for (const [key, collection] of this.collections) {
            if (!this._canReadField(key)) { continue; }
            const collectionData = data[String(key)];
            if (Array.isArray(collectionData)) {
                const fn = this._getCustomDeserialize(key);
                if (fn) {
                    promises.push(fn(this, collection, collectionData));
                }
            }
        }
        return Promise.all(promises);
    }

    /** do customized deserialization of properties */
    async deserializeCustomProperties(data:Record<string, unknown>):Promise<unknown> {
        const promises = [];
        for (const [key, property] of this.properties) {
            if (!this._canReadField(key)) { continue; }
            const stringKey = String(key);
            const propertyData = Object.prototype.hasOwnProperty.call(data, stringKey) ? data[stringKey] : property.getDefault();
            const fn = this._getCustomDeserialize(key);
            if (fn) {
                promises.push(fn(this, property, propertyData));
            }
        }
        for (const [key, property] of this.enumProperties) {
            if (!this._canReadField(key)) { continue; }
            const stringKey = String(key);
            const propertyData = Object.prototype.hasOwnProperty.call(data, stringKey) ? data[stringKey] : property.getDefault();
            const fn = this._getCustomDeserialize(key);
            if (fn) {
                promises.push(fn(this, property, propertyData));
            }
        }
        return Promise.all(promises);
    }

    /** call callback for each child observable */
    forEachChild(cb:(key:PropKey<T>, child:ObservableObject<any>)=>any):void {
        for (const entry of this.children) {
            cb(...entry);
        }
    }

    /** call callback for each observable collection */
    forEachCollection(cb:(key:PropKey<T>, collection:ObservableCollection<any>)=>any):void {
        for (const entry of this.collections) {
            cb(...entry);
        }
    }

    /** call callback for each property */
    forEachProperty(cb:(key:PropKey<T>, property:Property<unknown>)=>any):void {
        for (const entry of this.properties) {
            cb(...entry);
        }
        for (const entry of this.enumProperties) {
            cb(...entry);
        }
    }

    /** retrieve a child observable by name */
    getChild(key:PropKey<T>):ObservableObject<any> {
        return this.children.get(key) ?? noSuchProperty(this, key);
    }

    /** retrieve a collection property by name */
    getCollection(key:PropKey<T>):ObservableCollection<any> {
        return this.collections.get(key) ?? noSuchProperty(this, key);
    }

    /** retrieve a property by name */
    getProperty<ValueType = unknown>(key:PropKey<T>):Property<ValueType> {
        return (this.properties.get(key) ?? this.enumProperties.get(key) ?? noSuchProperty(this, key)) as Property<ValueType>;
    }

    /** retrieve a property value by name */
    getPropertyValue(propName:PropKey<T>):unknown {
        return this.getProperty(propName).get();
    }

    /** send out notification of a property changing */
    private async notifyPropertyChangedEventListeners(key:PropKey<T>):Promise<void> {
        if (!this._canNotifyField(key)) { return; }
        await Promise.all(this.propertyChangedListeners.map(cb=>cb(key)));
    }

    /** unregister for updates when a property changes */
    removePropertyChangedEventListener(listener:PropertyChangedListener<T>):void {
        this.propertyChangedListeners = this.propertyChangedListeners.filter(i=>i!==listener);
    }

    /** reset all properties to default values */
    async reset():Promise<void> {
        const promises = [];
        for (const child of this.children.values()) {
            promises.push(child.reset());
        }
        for (const collection of this.collections.values()) {
            promises.push(collection.clear());
        }
        for (const property of this.properties.values()) {
            promises.push(property.reset());
        }
        for (const property of this.enumProperties.values()) {
            promises.push(property.reset());
        }
        await Promise.all(promises);
    }

    /** convert to an object ready for JSON conversion and that could be read back with deserialize */
    async serialize():Promise<Record<string, unknown>> {
        const converted:Record<string, unknown> = {};

        for (const [key, child] of this.children) {
            if (!this._canWriteField(key)) { continue; }
            const fn = this._getCustomSerialize(key);
            converted[String(key)] = fn ? fn(this, child) : await child.serialize();
        }
        for (const [key, collection] of this.collections) {
            if (!this._canWriteField(key)) { continue; }
            const fn = this._getCustomSerialize(key);
            converted[String(key)] = fn ? fn(this, collection) : await collection.serialize();
        }
        for (const [key, property] of this.properties) {
            if (!this._canWriteField(key)) { continue; }
            if (!property.isDefault() || this._saveDefault(key)) {
                const fn = this._getCustomSerialize(key);
                converted[String(key)] = fn ? fn(this, property) : property.get();
            }
        }
        for (const [key, property] of this.enumProperties) {
            if (!this._canWriteField(key)) { continue; }
            if (!property.isDefault() || this._saveDefault(key)) {
                const fn = this._getCustomSerialize(key);
                converted[String(key)] = fn ? fn(this, property) : property.get();
            }
        }

        return converted;
    }

    /** set a property value by name */
    async setPropertyValue(propName:PropKey<T>, value:unknown):Promise<void> {
        await this.getProperty(propName).set(value);
    }
}
