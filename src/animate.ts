/**
 * useful functions for animating
 * @module Animate
 */
import './styles/animate.css';

/** animate element away and remove */
export async function animateAndRemove(element:HTMLElement, cssClass:string, animName:string):Promise<void> {
    return new Promise(resolve=>{animateAndRemoveNoWait(element, cssClass, animName, resolve);});
}
/** animate element away and remove */
export function animateAndRemoveNoWait(element:HTMLElement, cssClass:string, animName:string, doneCb?:(()=>void)):void {
    // I'm doing both a timeout and an event listener because I am paranoid
    let timeout = -1;
    let listener:((ev:AnimationEvent)=>void)|null = null;
    const doRemove = ()=>{
        if (listener) { element.removeEventListener('animationend', listener); }
        clearTimeout(timeout);
        element.remove();
        if (doneCb) {doneCb();}
    };
    listener = (ev:AnimationEvent)=>{
        if (ev.animationName===animName) {
            doRemove();
        }
    };
    const TIMEOUT = 400;
    timeout = window.setTimeout(doRemove, TIMEOUT);
    element.addEventListener('animationend', listener);
    element.classList.add(cssClass);
}

/** fade in */
export function appear(element:HTMLElement):void {
    element.classList.add('appear');
}

/** fade out and remove */
export function disappear(element:HTMLElement):void {
    animateAndRemoveNoWait(element, 'disappear', 'disappearAnim');
}

/** animate growing up to height */
export function growInMaxHeight(element:HTMLElement):void {
    const desiredHeight = element.scrollHeight;
    element.style.maxHeight = '0';
    element.classList.add('transitionMaxHeight');
    requestAnimationFrame(()=>{
        element.style.maxHeight = `${desiredHeight}px`;
        element.addEventListener('transitionend', ()=>{
            element.classList.remove('transitionMaxHeight');
            element.style.maxHeight = '';
        }, {once:true});
    });
}

/** animate shrinking down to nothing */
export function shrinkOutMaxHeight(element:HTMLElement):void {
    element.style.maxHeight = `${element.scrollHeight}px`;
    element.classList.add('transitionMaxHeight');
    requestAnimationFrame(()=>{
        element.style.maxHeight = '0';
        element.addEventListener('transitionend', ()=>{
            element.classList.remove('transitionMaxHeight');
        }, {once:true});
    });
}
