import {BaseBinding, Property} from './base-binding';
import { showHideElement } from '../util';
/** one way binding to `display` property of element style to tie its visibility to a boolean property */
export class VisibilityBinding extends BaseBinding<boolean> {
    /** create an instance asynchronously */
    static async create(element:HTMLElement, property:Property<boolean>):Promise<VisibilityBinding> {
        const self = new VisibilityBinding(
            element,
            property,
            '',
            null,
            async v=>{ showHideElement(element, v); }
        );
        await self.init();
        return self;
    }
}