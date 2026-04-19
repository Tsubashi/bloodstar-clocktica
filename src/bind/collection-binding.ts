import * as Animate from '../animate';
import {ObservableCollection, ObservableCollectionChangeAction, ObservableCollectionChangedEvent} from '../bind/observable-collection';
import {ObservableObject} from '../bind/observable-object';
import { isMobile } from '../bloodstar';
import { arrayGet, createElement } from '../util';
import { CollectionButtonsMgr } from './collection-buttons-mgr';

export type RenderFn<T extends ObservableObject<T>> = (itemData:T, collection:ObservableCollection<T>)=>Promise<Element>;
export type CleanupFn<T> = (renderedElement:Element, itemData:T)=>Promise<void>;
export type CollectionBindingOptions<ItemType extends ObservableObject<ItemType>> = {
    /** callback to clean up what renderFn does */
    cleanupFn?:CleanupFn<ItemType>;
    /** customize delete confirmation message */
    deleteConfirmMessage?:((item:ItemType)=>string);
    /** what to do when the edit button is clicked */
    editBtnCb?:(item:ItemType)=>Promise<void>;
    /** callback in which to creates the content of each row */
    renderFn?:RenderFn<ItemType>;
    /** whether to add a delete button */
    showDeleteBtn?:boolean;
    /** whether to add an edit button */
    showEditBtn?:boolean;
};

/** get a y coordinate for the mouse relative to some element */
function getRelativeY(event:MouseEvent, refElement:Element):number {
    const rect = refElement.getBoundingClientRect();
    return event.clientY - rect.y;
}

/** check whether the mouse position indicates to position the dropped item after the hovered item instead of before */
function checkInsertAfter(event:MouseEvent, refElement:Element):boolean {
    return getRelativeY(event, refElement) > 0.5 * refElement.getBoundingClientRect().height;
}

/** create default row content */
async function defaultRenderFn<T extends ObservableObject<T>>(itemData:T/*, collection:ObservableCollection<T>*/):Promise<Element> {
    const row = document.createElement("div");

    itemData.forEachProperty((key, prop)=>{
        row.appendChild(createElement({t:'span', txt:`${key}: ${prop.get()}, `}));
    });

    return row;
}

/** clean up default row content */
async function defaultCleanupFn<T extends ObservableObject<T>>(/*element: Node, itemData: T*/):Promise<void> {
    // nothing to do
}

const MARKERATTRIBUTE = 'RenderedByCollectionBinding';

export class CollectionBinding<ItemType extends ObservableObject<ItemType>> {
    /** ol element this will keep in sync with the data */
    private listElement:HTMLOListElement;

    /** collection we keep the DOM in sync with */
    private collection:ObservableCollection<ItemType>;

    /** manages the buttons in each item */
    private buttonsMgr:CollectionButtonsMgr<ItemType>;

    /** how to create a DOM element for an item in the list */
    private renderFn:RenderFn<ItemType>;

    /** how to destroy a DOM element for an item in the list */
    private cleanupFn:CleanupFn<ItemType>;

    /** what is being dragged */
    private dragged:HTMLLIElement|null;

    /**
     * handling an edge case: when the user moves quickly, they might not get a dragleave/drop for every dragover that happened
     * this tracks the dragOvers so that they can all be cleaned up
     * */
    private dragOvers:Set<HTMLLIElement>;

    /** use CollectionBinding<...>.create instead */
    private constructor(
        listElement:HTMLOListElement,
        collection:ObservableCollection<ItemType>,
        options?:CollectionBindingOptions<ItemType>
    ) {
        this.listElement = listElement;
        this.collection = collection;
        this.renderFn = options?.renderFn ?? defaultRenderFn;
        this.cleanupFn = options?.cleanupFn ?? defaultCleanupFn;
        this.dragged = null;
        this.dragOvers = new Set();

        collection.addCollectionChangedListener(async (e)=>this.collectionChanged(e));

        this.buttonsMgr = new CollectionButtonsMgr(this, collection, options);
    }

    /** asynchronous creation */
    static async create<T extends ObservableObject<T>>(
        listElement:HTMLOListElement,
        collection:ObservableCollection<T>,
        options?:CollectionBindingOptions<T>
    ):Promise<CollectionBinding<T>> {
        const self = new CollectionBinding(listElement, collection, options);

        // sync DOM to initial value
        await self.clear();
        await self.insert(0, collection.getItems());

        return self;
    }

    /** any styles added for dragover events needs to get removed */
    cleanUpDragOverStyles():void {
        for (const elem of this.dragOvers) {
            elem.classList.remove('dropBefore');
            elem.classList.remove('dropAfter');
        }
        this.dragOvers.clear();
    }

    /** keep DOM in sync with collection changes */
    private async collectionChanged(event:ObservableCollectionChangedEvent<ItemType>):Promise<void> {
        switch (event.action) {
            case ObservableCollectionChangeAction.Add:
                await this.insert(event.newStartingIndex, event.newItems);
                break;
            case ObservableCollectionChangeAction.Move:
                this.move(event.oldStartingIndex, event.newStartingIndex);
                break;
            case ObservableCollectionChangeAction.Replace:
                await this.replace(event.newStartingIndex, event.oldItems, event.newItems);
                break;
            case ObservableCollectionChangeAction.Remove:
                await this.remove(event.oldStartingIndex, event.oldItems);
                break;
            default:
                throw new Error(`invalid action ${event.action}`);
        }
    }

    /** check whether we are over a valid drop target */
    private dragVerify(e:DragEvent):boolean {
        // must be dragging something
        if (!this.dragged) { return false; }

        // must be over/dropping onto an element
        const {target} = e;
        if (!(target instanceof Element)) { return false; }

        // must be in a listitem
        const listItemElement = target.closest('li');
        if (!listItemElement) { return false; }

        // dragged must be in a list
        const draggedList = this.dragged.closest('ol');
        if (draggedList !== this.listElement) { return false; }

        // hovered/dropped-onto item must be in the same list
        const overList = listItemElement.closest('ol');
        if (overList !== this.listElement) { return false; }

        return true;
    }

    /** event handler for dragover */
    private dragover(e:DragEvent) {
        if (!this.dragVerify(e)) { return; }
        if (!(e.target instanceof Element)) { return; }
        const listItemElement = e.target.closest('li');
        if (!listItemElement) { return; }

        this.dragOvers.add(listItemElement);

        e.preventDefault();
        if (checkInsertAfter(e, listItemElement)) {
            listItemElement.classList.remove('dropBefore');
            listItemElement.classList.add('dropAfter');
        } else {
            listItemElement.classList.remove('dropAfter');
            listItemElement.classList.add('dropBefore');
        }
    }

    /** event handler for dragleave */
    private dragleave(e:DragEvent) {
        if (!(e.target instanceof Element)) { return; }
        const listItemElement = e.target.closest('li');
        if (!listItemElement) { return; }

        this.cleanUpDragOverStyles();
    }

    /** react to dropping a dragged item */
    private async drop(e:DragEvent):Promise<void> {
        try {
            if (!this.dragVerify(e)) { return; }
            e.preventDefault();

            const listItemElement = e.target instanceof Element && e.target.closest('li');
            if (!listItemElement) { return; }
            if (!listItemElement.dataset.index) { return; }
            if (!this.dragged) { return; }
            if (!this.dragged.dataset.index) { return; }

            const fromIndex = parseInt(this.dragged.dataset.index, 10);
            const dropIndex = parseInt(listItemElement.dataset.index, 10);
            const insertAfter = checkInsertAfter(e, listItemElement);

            const toIndex = (dropIndex > fromIndex)
                ? (insertAfter ? dropIndex : dropIndex-1)
                : (insertAfter ? dropIndex+1 : dropIndex);

            // change the collection, our collection change listener will
            // update the DOM to reflect the change
            await this.collection.move(fromIndex, toIndex);

        } finally {
            this.cleanUpDragOverStyles();
            this.dragged = null;
        }
    }

    /** dragging of an item began */
    static dragstart(e:DragEvent):void {
        if (e.target instanceof Element) {
            const listItemElement = e.target.closest('li');
            if (!listItemElement) {return;}
            listItemElement.classList.add('dragging');
            Animate.shrinkOutMaxHeight(listItemElement);
        }
    }

    /** dragging ended on an item */
    static dragend(e:DragEvent):void {
        if (e.target instanceof Element) {
            const listItemElement = e.target.closest('li');
            if (!listItemElement) {return;}
            listItemElement.classList.remove('dragging');
            Animate.growInMaxHeight(listItemElement);
        }
    }

    /** create and insert DOM elements at the specified index */
    private async insert(insertLocation:number, items:readonly ItemType[]):Promise<void> {
        const renderPromises = items.map(async (item, i)=>this.renderListItem(i + insertLocation, item));
        const renderResults = await Promise.all(renderPromises);
        for (const {i, elem} of renderResults) {
            if (i === this.listElement.childNodes.length) {
                this.listElement.appendChild(elem);
            } else {
                this.listElement.insertBefore(elem, this.listElement.childNodes[i]);
            }
        }
        this.updateIndices(insertLocation);
    }

    /** change the order of items */
    private move(oldIndex:number, newIndex:number):void {
        if (oldIndex === newIndex) { return; }
        const node = this.listElement.childNodes[oldIndex];
        const refIndex = (newIndex > oldIndex) ? newIndex+1 : newIndex;
        if (refIndex >= this.listElement.childNodes.length) {
            this.listElement.appendChild(node);
        } else {
            const insertBeforeNode = this.listElement.childNodes[refIndex];
            this.listElement.insertBefore(node, insertBeforeNode);
        }
        this.updateIndices(Math.min(oldIndex, newIndex), Math.max(oldIndex, newIndex)+1);
    }

    /** update DOM elements to new data */
    private async replace(start:number, oldData:readonly ItemType[], newData:readonly ItemType[]):Promise<void> {
        if (!oldData.length) {return;}
        if (!newData.length) {return;}
        if (start < 0) {return;}
        if (start >= this.listElement.childNodes.length) {return;}
        const n = newData.length;

        for (let i=0; i<n; i++) {
            const oldChild = this.listElement.childNodes[start+i];
            await this.cleanupListItem(oldChild, oldData[i]);
            const {elem} = await this.renderListItem(i, newData[i]);
            this.listElement.replaceChild(elem, oldChild);
        }
    }

    /** remove DOM elements in the specified index range */
    private async remove(start:number, oldItems:readonly ItemType[]):Promise<void> {
        const n = oldItems.length;
        if (n === 0) {return;}
        if (start < 0) {return;}
        if (start >= this.listElement.childNodes.length) {return;}

        const cleanUpPromises = [];

        for (let i=n-1; i>=0; i--) {
            const childIndex = i+start;
            const child = this.listElement.childNodes[childIndex];
            this.listElement.removeChild(child);
            cleanUpPromises.push(this.cleanupListItem(child, oldItems[i]));
        }

        await Promise.all(cleanUpPromises);

        this.updateIndices(start);
    }

    /** create DOM list item for a data item */
    private async renderListItem(i:number, itemData:ItemType):Promise<{i:number; elem:Element}> {
        const li = document.createElement('li');
        li.draggable = true;
        li.dataset.index = String(i);
        if (!isMobile()) {
            li.addEventListener('drag', ()=>{this.dragged = li;});
            li.addEventListener('dragstart', CollectionBinding.dragstart);
            li.addEventListener('dragend', CollectionBinding.dragend);
            li.addEventListener('dragover', e=>{ this.dragover(e); });
            li.addEventListener('dragleave', e=>{ this.dragleave(e); });
            li.addEventListener('drop', async e => this.drop(e));
        }

        const renderedElem = await this.renderFn(itemData, this.collection);
        renderedElem.setAttribute(MARKERATTRIBUTE, 'true');
        li.appendChild(renderedElem);

        if (renderedElem instanceof HTMLElement) {
            this.buttonsMgr.updateButtons(renderedElem, itemData, i);
        }

        return {i, elem:li};
    }

    /** keep dataset index in sync */
    private updateIndices(startPosition:number, endPosition?:number):void {
        const end = (endPosition === undefined) ? this.listElement.childNodes.length : endPosition;
        for (let i=startPosition; i<end; ++i) {
            const child = this.listElement.childNodes[i];
            if (child instanceof HTMLElement) {
                child.dataset.index = String(i);
            }
        }
    }

    /** cleanup */
    async destroy():Promise<void> {
        this.buttonsMgr.destroy();
        this.collection.removeAllCollectionChangedListeners();
        await this.clear();
        this.dragged = null;
    }

    /** cleanup whatever was done by renderListItem */
    private async cleanupListItem(listItem:Node, oldData:ItemType):Promise<void> {
        if (!(listItem instanceof HTMLElement)) { return; }
        if (!listItem.dataset.index ) { return; }

        const renderedElement = listItem.firstChild;
        if (renderedElement instanceof HTMLElement) {
            await this.cleanupFn(renderedElement, oldData);
        }
    }

    /** remove any added elements */
    private async clear():Promise<void> {
        const cleanUpPromises = [];

        for (let i=0; i<this.listElement.childNodes.length; ++i) {
            const child = this.listElement.childNodes[i];
            const data = this.collection.get(i);
            if (!data) {continue;}
            cleanUpPromises.push(this.cleanupListItem(child, data));
        }

        await Promise.all(cleanUpPromises);

        this.listElement.innerText = '';
    }

    /** find the HTMLElement matching the index, or null */
    getElement(i:number):HTMLElement|null {
        const elem = arrayGet(this.listElement.childNodes, i, null);
        return (elem instanceof HTMLElement) ? elem : null;
    }

    /** find the index matching the HTMLElement or -1 */
    // eslint-disable-next-line class-methods-use-this
    getIndex(elem:HTMLElement):number {
        const listItemElement = elem.closest('li');
        if (!listItemElement) { return -1; }
        if (!listItemElement.dataset.index) { return -1; }
        const n = parseInt(listItemElement.dataset.index, 10);
        return isNaN(n) ? -1 : n;
    }

    /** iterate over rows of the list */
    forEachElement(cb:(elem:HTMLElement, itemData:ItemType, i:number)=>void):void {
        const listItems = this.listElement.childNodes;
        const n = listItems.length;
        for (let i=0; i<n; ++i) {
            const listItem = arrayGet(listItems, i, null);
            if (!(listItem instanceof HTMLElement)) {continue;}
            const itemData = this.collection.get(i);
            if (!itemData) {continue;}
            const children = listItem.childNodes;
            for (let j = 0; j<children.length; ++j) {
                const child = arrayGet(children, j, null);
                if (!(child instanceof HTMLElement)) {continue;}
                if (!child.hasAttribute(MARKERATTRIBUTE)) {continue;}
                cb(child, itemData, i);
            }
        }
    }
}
