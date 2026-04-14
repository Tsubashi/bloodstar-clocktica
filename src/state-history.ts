/**
 * Work with the browser to manage states that the user can back out of.
 * @module StateHistory
 */
import Locks from './lock';
export type CurtainState = {type:'curtain';curtainId:string};
export type CbmState = {type:'cbm';listId:number;fromIndex:number};
export type HistoryState = CbmState | CurtainState | null;
type HistoryStateInternal = {depth:number; state:HistoryState; canGoForward:boolean};

export type StateChangeListener = (state:HistoryState)=>void;

/** so we can tell if going forward or back */
let lastDepth = 0;

/** state change listeners */
let listeners:StateChangeListener[] = [];

/** register to receive state changes */
export function addListener(listener:StateChangeListener):void {
    listeners.push(listener);
}

/** back out of all states */
export async function clear():Promise<void> {
    if (depthFromHistory() <= 0) {return Promise.resolve();}
    return Locks.enqueue('state-history', async ()=>{
        const depth:number = depthFromHistory();
        if (depth <= 0) { return Promise.resolve(); }
        return new Promise<void>(resolve=>{
            window.addEventListener('popstate', ()=>setTimeout(resolve, 1), {once:true});
            history.go(-depth);
            // popstate listener takes it from here
        });
    });
}

/** get current depth based on history */
function depthFromHistory():number {
    return history.state?.depth ?? 0;
}

/** check current state */
export function getState():HistoryState {
    const internalState:HistoryStateInternal|null = history.state;
    return internalState?.state ?? null;
}

/** notify all listeners that the state changed */
function notifyListeners(state:HistoryState):void {
    for (const listener of listeners.concat()) {
        listener(state);
    }
}

/** back up */
export async function pop():Promise<void> { return popN(1); }

/** back up */
async function popN(n:number):Promise<void> {
    if (n<=0) {return Promise.resolve();}
    const times = Math.min(n, depthFromHistory());
    if (times <= 0) {return Promise.resolve();}
    return Locks.enqueue('state-history', async ()=>{
        const popHowMany = Math.min(times, depthFromHistory());
        if (popHowMany <= 0) { return Promise.resolve(); }
        return new Promise<void>(resolve=>{
            window.addEventListener('popstate', ()=>setTimeout(resolve, 1), {once:true});
            history.go(-popHowMany);
            // popstate listener takes it from here
        });
    });
}

/** push state */
export async function pushState(state:HistoryState, canGoForward:boolean):Promise<void> {
    // clear first if the current state is not one we can go forward from
    if (history.state && (history.state.canGoForward === false)) {
        await clear();
    }

    // back up out of meaningless states
    const popAmnt = depthFromHistory() - lastDepth;
    if (popAmnt > 0) {
        await popN(popAmnt);
    }

    // forward to new state
    return Locks.enqueue('state-history', async ()=>{
        // pushState does NOT cause a popstate event. so we must call listeners
        // and update lastDepth here
        lastDepth = 1 + depthFromHistory();
        history.pushState({depth: lastDepth, state, canGoForward}, '');
        notifyListeners(state);
    });
}

/** undo addListener */
export function removeListener(listener:StateChangeListener):void {
    listeners = listeners.filter(i => i!==listener);
}

/** clear history and go to state */
export async function setState(state:HistoryState, canGoForward:boolean):Promise<void> {
    const depth:number = depthFromHistory();
    if (depth > 0) {
        await popN(depth);
    }
    await pushState(state, canGoForward);
}

/** watch for backing out of states */
window.addEventListener('popstate', (e:PopStateEvent)=>{
    const internalState:HistoryStateInternal|null = e.state;
    const newDepth = internalState?.depth ?? 0;
    if (newDepth < lastDepth) {
        lastDepth = newDepth;
        notifyListeners(internalState?.state ?? null);
    }
});

// always start in no special state at all
if (history.state !== null) {
    history.replaceState(null, '');
}
