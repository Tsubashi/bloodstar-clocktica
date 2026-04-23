/**
 * Miscellaneous useful things
 * @module Util
 */
import {showError, showNoWait as showMessageNoWait} from './dlg/blood-message-dlg';
import {SITE_ROOT} from './config';

/** configuration used to create DOM elements */
export type CreateElementOptions<K extends keyof HTMLElementTagNameMap> = {
    /** tag name of the element to create */
    t:K;

    /** attributes to set on the created element */
    a?:Record<string, string>;

    /** children to append or configuration used to create those children */
    children?:CreateElementsOptions;

    /** css classes to add to the element */
    css?:string[];

    /** event listeners to add to the element */
    events?:Record<string, EventListenerOrEventListenerObject|undefined>;

    /** set innerHTML on the element. doesn't really work at the same time as txt */
    html?:string;

    /** id to set on the element. doesn't really work at the same time as html */
    id?:string;

    /** inner text to set on the element */
    txt?:string;
};

export type CreateElementsOptions = (CreateElementOptions<keyof HTMLElementTagNameMap>|Node)[];

/** more concise element creation. see comments on CreateElementOptions */
export function createElement<K extends keyof HTMLElementTagNameMap>(options:CreateElementOptions<K>):HTMLElementTagNameMap[K] {
    const {
        a: attributes,
        children,
        css: classes,
        events: eventListeners,
        html,
        id,
        txt: innerText,
        t: tag,
    } = options;
    const element = document.createElement(tag);

    if (id) {
        element.id = id;
    }

    if (attributes) {
        for (const key of Object.keys(attributes)) {
            const value = attributes[key];
            element.setAttribute(key, value);
        }
    }

    if (html) {
        element.innerHTML = html;
    }

    if (innerText) {
        element.innerText = innerText;
    }

    if (classes) {
        for (const className of classes) {
            element.classList.add(className);
        }
    }

    if (children) {
        for (const childOptions of children) {
            if (childOptions instanceof Node) {
                element.appendChild(childOptions);
            } else {
                const child = createElement(childOptions);
                element.appendChild(child);
            }
        }
    }

    if (eventListeners) {
        for (const eventType of Object.keys(eventListeners)) {
            const listener = eventListeners[eventType];
            if (!listener) {continue;}
            element.addEventListener(eventType, listener);
        }
    }

    return element;
}

/** attempt to read some json from the internet */
export async function fetchJson<T>(uri:string):Promise<T|null> {
    let response:Response;
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>{
        controller.abort();
        showMessageNoWait('Network Error', `Request timed out trying to reach ${uri}`);
    }, 15*1000);
    try {
        response = await fetch(uri, {
            method: 'GET',
            headers:{
                'Accept':'application/json'
            },
            mode: 'cors',
            signal: controller.signal
        });

        if (!response.ok) {
            console.error(`${response.status}: (${response.type}) ${response.statusText}`);
            showMessageNoWait('Network Error', `Something went wrong while trying to reach ${uri}`);
            return null;
        }
    } catch (error: unknown) {
        console.error(error);
        showMessageNoWait('Network Error', `Something went wrong while trying to reach ${uri}`);
        return null;
    } finally {
        clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    const responseJson = JSON.parse(responseText);
    return responseJson;
}

/** get url for when you want to use a cors proxy */
export function getCorsProxyUrl(url:string):string {
    return `${SITE_ROOT}/corsproxy/?url=${encodeURIComponent(escape(url))}`;
}

/** set event listeners for clicks, return a function you can call to undo it */
export function hookupClickEvents(data: [string, (e: Event) => void][]):()=>void {
    function wrapCb(cb:(e: Event) => void):(e: Event) => void {
        return async (e: Event)=>{
            try {cb(e);}
            catch (error: unknown) {
                await showError('Error', 'Something went wrong', error);
            }
        };
    }

    const listenersToRemove: [string, (e:Event)=>void][] = [];

    for (const [id, cb] of data) {
        const element = document.getElementById(id);
        if (element) {
            const listener = wrapCb(cb);
            listenersToRemove.push([id, listener]);
            element.addEventListener("click", listener);
        }
    }

    return ()=>{
        for (const [id, listener] of listenersToRemove) {
            const element = document.getElementById(id);
            if (element) {
                element.removeEventListener("click", listener);
            }
        }
    };
}

/** show/hide the element */
export function showHideElement(element:Element, visible:boolean):void {
    if (visible) {
        element.classList.remove('hidden');
    } else {
        element.classList.add('hidden');
    }
}

/** ordinal string based on number */
// TODO: the 11/12/13 -> 'th' exception only fires for n === 11/12/13, not for
// any number ending in those two digits. So 111 -> '111st' instead of '111th',
// 212 -> '212nd' instead of '212th', etc. The canonical rule is `n % 100`.
export function getOrdinalString(n:number):string {
    if (n <= 0) { return n.toFixed(0); }
    switch (n)
    {
        case 11:
        case 12:
        case 13:
            return `${n.toFixed(0)}th`;
        default:
            switch (n % 10)
            {
                case 1: return `${n.toFixed(0)}st`;
                case 2: return `${n.toFixed(0)}nd`;
                case 3: return `${n.toFixed(0)}rd`;
                default: return `${n.toFixed(0)}th`;
            }
    }
}

/** go through a HTMLElement and all its child HTMLElements, and call the function on them */
export async function walkHTMLElements(element:HTMLElement, f:(e:HTMLElement)=>Promise<void>):Promise<void> {
    if (!(element instanceof HTMLElement)) {return;}
    const elements = [];
    const stack:HTMLElement[] = [element];
    while (stack.length) {
        const htmlElement = stack.pop();
        if (htmlElement) {
            elements.push(htmlElement);
            for (let i=0; i<htmlElement.children.length; i++) {
                const child = htmlElement.children[i];
                if (child instanceof HTMLElement) {
                    stack.push(child);
                }
            }
        }
    }
    await Promise.all(elements.map(f));
}

/** check that the index is valid for the arraylike item */
export function arrayGet<T, U=undefined>(arr:ArrayLike<T>, i:number, defaultValue:U):T|U {
    if (!isNaN(i) && (i>=0) && (i<arr.length)) {
        return arr[i];
    }
    return defaultValue;
}

/** check that the index is valid for the arraylike item */
export function arrayGetLast<T, U=undefined>(arr:ArrayLike<T>, defaultValue:U):T|U {
    return arrayGet(arr, arr.length-1, defaultValue);
}

/** check that the index is valid for the arraylike item */
export function boundsCheck(i:unknown, arr:ArrayLike<unknown>):boolean {
    return (typeof i === 'number')
        && !isNaN(i)
        && (i>=0)
        && (i<arr.length);
}

/** test whether you have a thing with string keys */
// TODO: returns true for arrays (typeof [] === 'object'), but the `x is
// Record<string, unknown>` predicate claims to narrow to plain records.
// Callers using this as a type guard will treat arrays as records.
export function isRecord(x:unknown): x is Record<string, unknown> {
    if (x === null) {return false;}
    switch (typeof x) {
        case 'object':
            return true;
        case 'bigint':
        case 'boolean':
        case 'function':
        case 'number':
        case 'string':
        case 'symbol':
        case 'undefined':
            return false;
        default:
            throw new Error(`unhandled type in isRecord: ${typeof x}`);
    }
}
