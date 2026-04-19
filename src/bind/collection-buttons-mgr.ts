/**
 * Creates and manages buttons for managing the order of an observable collection
 * @module CollectionButtonsMgr
 */
import { arrayGet, createElement } from "../util";
import {show as getConfirmation} from "../dlg/yes-no-dlg";
import { showErrorNoWait } from "../dlg/blood-message-dlg";
import * as StateHistory from "../state-history";

type CollectionBinding<ItemType> = {
    forEachElement: (cb:(elem:HTMLElement, itemData:ItemType, i:number)=>void) => void;
    getElement: (i:number)=>HTMLElement|null;
    getIndex: (elem:HTMLElement)=>number;
};
type ObservableCollectionListener = (event:unknown)=>Promise<void>;
type ObservableCollection<ItemType> = {
    addCollectionChangedListener: (cb:ObservableCollectionListener)=>void;
    deleteItem: (character:ItemType)=>Promise<void>;
    move: (oldIndex:number, newIndex:number)=>Promise<void>;
    moveItemUp: (value:ItemType)=>Promise<void>;
    moveItemDown: (value:ItemType)=>Promise<void>;
    removeCollectionChangedListener: (cb:ObservableCollectionListener)=>void;
};

const MARKERATTRIBUTE = 'AddedByCollectionButtonsMgr';

/** used to make sure there's a unique identifier for each CollectionButtonsMgr instance */
let counter = 0;

export type CollectionButtonsMgrOptions<ItemType> = {
    /** customize delete confirmation message */
    deleteConfirmMessage?:((item:ItemType)=>string);
    /** what to do when the edit button is clicked */
    editBtnCb?: (item:ItemType)=>Promise<void>;
    /** whether to add a delete button */
    showDeleteBtn?:boolean;
    /** whether to add an edit button */
    showEditBtn?:boolean;
};

export class CollectionButtonsMgr<ItemType> {
    /** collection being edited */
    collection:ObservableCollection<ItemType>;

    /** collection being edited */
    collectionBinding:CollectionBinding<ItemType>;

    /** remember for cleanup */
    collectionChangedListener:()=>Promise<void>;

    /** customize delete confirmation message */
    deleteConfirmMessage:((item:ItemType)=>string)|null;

    /** what to do when the edit button is clicked */
    editBtnCb: ((item:ItemType)=>Promise<void>)|null;

    /** id for this specific instance */
    id:number;

    /** index of the value being moved */
    index:number;

    /** remember for cleanup */
    keyupListener:(e:KeyboardEvent)=>void;

    /** whether to add a delete button */
    showDeleteBtn?:boolean;

    /** whether to add an edit button */
    showEditBtn?:boolean;

    /** remember for cleanup */
    stateListener:StateHistory.StateChangeListener;

    /** prepare for use */
    constructor(
        binding:CollectionBinding<ItemType>,
        collection:ObservableCollection<ItemType>,
        options?:CollectionButtonsMgrOptions<ItemType>
    ) {
        this.collection = collection;
        this.collectionBinding = binding;
        this.deleteConfirmMessage = options?.deleteConfirmMessage??null;
        this.editBtnCb = options?.editBtnCb??null;
        this.index = -1;
        this.showDeleteBtn = options?.showDeleteBtn??false;
        this.showEditBtn = options?.showEditBtn??false;

        // if the collection changes under us, cancel
        this.collectionChangedListener = async ()=>this.cancelMove();
        collection.addCollectionChangedListener(this.collectionChangedListener);

        // escape to back out of move mode
        this.keyupListener = async (event:KeyboardEvent) => {
            if (event.code !== 'Escape') {return Promise.resolve();}
            return this.cancelMove();
        };
        document.addEventListener('keyup', this.keyupListener);

        this.id = counter++;
        this.stateListener = this.onStateChanged.bind(this);
        StateHistory.addListener(this.stateListener);
    }

    /** add a button to the element */
    private static addButton(elem:HTMLElement, text:string, onclick:(e:MouseEvent)=>Promise<void>):void {
        const btn = createElement({t:'button', txt:text});
        btn.onclick = onclick;
        btn.setAttribute(MARKERATTRIBUTE, 'true');
        elem.append(btn);
    }

    /** add the delete item button */
    private addDeleteButton(elem:HTMLElement, item:ItemType):void {
        CollectionButtonsMgr.addButton(elem, 'Delete', async () => {
            try {
                const confirmationMessage = this.deleteConfirmMessage ? this.deleteConfirmMessage(item) : 'Are you sure you want to delete this item?';
                if (await getConfirmation({
                    title: 'Confirm Delete',
                    message: confirmationMessage
                })) {
                    await this.collection.deleteItem(item);
                }
            } catch (e: unknown) {
                showErrorNoWait('Error', 'Error encountered during deletion', e);
            }
        });
    }

    /** enter move mode */
    async beginMove(i:number):Promise<void> {
        return StateHistory.setState({type:'cbm', listId:this.id, fromIndex:i}, false);
    }

    /** back out of move mode */
    async cancelMove():Promise<void> {
        const state = StateHistory.getState();
        const index = (state && (state.type === 'cbm') && (state.listId === this.id)) ?
            state.fromIndex :
            -1;
        if (index !== -1) {
            return StateHistory.clear();
        }
        return Promise.resolve();
    }

    /** clear all added buttons from element */
    private static clearButtons(elem:HTMLElement):void {
        const buttons = elem.getElementsByTagName('button');
        for (let i=buttons.length-1; i>=0; --i) {
            const button = arrayGet(buttons, i, null);
            if (button?.hasAttribute(MARKERATTRIBUTE)) {
                button.remove();
            }
        }
    }

    /** clean up */
    destroy():void {
        StateHistory.removeListener(this.stateListener);
        this.collection.removeCollectionChangedListener(this.collectionChangedListener);
        document.removeEventListener('keyup', this.keyupListener);
    }

    /** do the move */
    private async doMove(toElem:HTMLElement):Promise<void> {
        if (isNaN(this.index) || (this.index < 0)) {return;}
        const toIndex = this.collectionBinding.getIndex(toElem);
        if (isNaN(toIndex) || (toIndex < 0)) {return;}
        try {
            await this.collection.move(this.index, toIndex);
        } catch {
            await this.cancelMove();
        }
    }

    /** update with state changes */
    private onStateChanged(state:StateHistory.HistoryState):void {
        const index = (state && (state.type === 'cbm') && (state.listId === this.id)) ?
            state.fromIndex :
            -1;
        if (this.index !== index) {
            this.index = index;
            this.updateAllButtons();
        }
    }

    /** update buttons for the entire list */
    private updateAllButtons():void {
        this.collectionBinding.forEachElement((elem:HTMLElement, itemData:ItemType, i:number)=>{
            this.updateButtons(elem, itemData, i);
        });
    }

    /** redo the row's buttons based on edit mode */
    updateButtons(elem:HTMLElement, itemData:ItemType, i:number):void {
        CollectionButtonsMgr.clearButtons(elem);

        if (this.index !== -1) {
            if (this.index === i) {
                // this is the one being moved
                CollectionButtonsMgr.addButton(elem, 'Cancel Move', async ()=>this.cancelMove());
                return;
            }
            // place we can move to
            CollectionButtonsMgr.addButton(elem, 'Move Here', async ()=>this.doMove(elem));
            return;
        }

        if (this.showEditBtn) {
            const {editBtnCb} = this;
            if (editBtnCb) {
                CollectionButtonsMgr.addButton(elem, 'Edit', async ()=>editBtnCb(itemData));
            }
        }
        CollectionButtonsMgr.addButton(elem, 'Move', async ()=>this.beginMove(i));
        if (this.showDeleteBtn) {
            this.addDeleteButton(elem, itemData);
        }
    }
}
