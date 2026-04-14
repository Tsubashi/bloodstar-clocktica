/**
 * @module AttributeBinding
 */
import {BaseBinding, Property} from './base-binding';

/** one way binding to map a string property to an attribute of an element */
export default class AttributeBinding extends BaseBinding<string> {
    /** create an instance asynchronously */
    static async create(element:HTMLElement, attributeName:string, property:Property<string>):Promise<AttributeBinding> {
        const self = new AttributeBinding(
            element,
            property,
            '',
            null,
            async v=>{element.setAttribute(attributeName, v);});
        await self.init();
        return self;
    }
}