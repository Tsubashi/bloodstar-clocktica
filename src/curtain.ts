import './styles/curtain.css';
import * as StateHistory from "./state-history";

/** remember which curtain is up, if any */
let curtainId = '';

/** close entire curtain history */
export async function closeAllCurtains():Promise<void> {
    return StateHistory.clear();
    // listener picks it up from there
}

/** close currently-open curtain menu, if any */
export async function closeCurtain():Promise<void> {
    const state = StateHistory.getState();
    if (state && (state.type === 'curtain') && (state.curtainId === curtainId)) {
        return StateHistory.pop();
        // listener picks it up from there
    }
    return Promise.resolve();
}

/** close currently-open curtain menu and open a new one */
export async function openCurtainMenu(id:string):Promise<void> {
    return StateHistory.pushState({type:'curtain', curtainId:id}, true);
}

/** sync with browser when it changes */
StateHistory.addListener((state:StateHistory.HistoryState)=>{
    const previousCurtainId = curtainId;
    curtainId = (state && (state.type === 'curtain')) ? state.curtainId : '';
    if ((previousCurtainId !== curtainId) && (previousCurtainId !== '')) {
        document.getElementById(previousCurtainId)?.removeAttribute('open');
    }
    if (curtainId !== '') {
        document.getElementById(curtainId)?.setAttribute('open', 'true');
    }
});