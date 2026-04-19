import {BaseBinding, Property} from './base-binding';

function updateValueLabel(element:HTMLInputElement, valueLabel:HTMLElement|null) {
    if (valueLabel) {
        const {places} = valueLabel.dataset;
        if (places === undefined) {
            valueLabel.innerText = element.value;
        } else {
            valueLabel.innerText = Number(element.value).toFixed(Number(places));
        }
    }
}

async function syncFromElementToProperty(element:HTMLInputElement, valueLabel:HTMLElement|null, property:Property<number>):Promise<void> {
    await property.set(parseFloat(element.value));
    updateValueLabel(element, valueLabel);
}
async function syncFromPropertyToElement(element:HTMLInputElement, valueLabel:HTMLElement|null, property:Property<number>):Promise<void> {
    element.value=String(property.get());
    updateValueLabel(element, valueLabel);
}

export default class SliderBinding extends BaseBinding<number> {
    /** create an instance asynchronously */
    static async create(element:HTMLInputElement, valueLabel:HTMLElement|null, property:Property<number>):Promise<SliderBinding> {
        const self = new SliderBinding(
            element,
            property,
            'change',
            async ()=>syncFromElementToProperty(element, valueLabel, property),
            async ()=>syncFromPropertyToElement(element, valueLabel, property)
        );
        await self.init();
        return self;
    }
}