import {BaseBinding, Property} from './base-binding';

/** one way binding to modify class list based on the property value and callback */
export class StyleBinding<ValueType> extends BaseBinding<ValueType> {
    /** create an instance asynchronously */
    static async create<ValueType>(element:HTMLElement, property:Property<ValueType>, cb:(value:ValueType, classList:DOMTokenList)=>void):Promise<StyleBinding<ValueType>> {
        const self = new StyleBinding<ValueType>(
            element,
            property,
            '',
            null,
            async v=>{ cb(v, element.classList); }
        );
        await self.init();
        return self;
    }
}