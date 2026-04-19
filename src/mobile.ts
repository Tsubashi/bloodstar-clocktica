import './styles/mobile.css';
import { hookupClickEvents } from './util';
import { init, tabClicked } from "./bloodstar";
import { closeCurtain, openCurtainMenu } from './curtain';

/** initialize listeners for mobile version of bloodstar */
function initMobileBindings():void {
    hookupClickEvents([
        ['mobileHamburger', async ()=>openCurtainMenu('mobileMainMenu')],
        ['mobileFileButton', async ()=>openCurtainMenu('mobileFileMenu')],
        ['mobileImportButton', async ()=>openCurtainMenu('mobileImportMenu')],
        ['mobilePublishButton', async ()=>openCurtainMenu('mobilePublishMenu')],
        ['mobileSharingButton', async ()=>openCurtainMenu('mobileSharingMenu')],

        ['charlistTabBtn', async ()=>tabClicked('charlistTabBtn', 'characterlisttab')],
    ]);

    // find ALL `closeCurtainBtn`
    const allCloseBtns = document.getElementsByClassName('closeCurtainBtn');
    for (let i = 0; i < allCloseBtns.length; i++) {
        const btn = allCloseBtns[i];
        btn.addEventListener("click", closeCurtain);
    }

    // escape to close curtain
    document.addEventListener('keyup', async (event:KeyboardEvent) => {
        if (event.code !== 'Escape') {return Promise.resolve();}
        return closeCurtain();
    });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
init({mobile:true}).then(()=>{
    initMobileBindings();
});
