/**
 * send a command to the server
 * @module Cmd
 */

import { spinner } from "../dlg/spinner-dlg";
import { SITE_ROOT } from "../config";

const TIMEOUT = 15*1000;
const MAXRETRIES = 1;

export type UserPass = {username:string; password:string};

export class TimeoutError extends Error {}

/** track abort controllers that we know were used for a timeout */
const timeoutControllers = new WeakSet<AbortController>();

/**
 * send a command to the server, await response
 * Brings up the loading spinner during the operation
 */
export default async function cmd<ResultType = unknown>(cmdName:string, spinnerMessage:string, body?:BodyInit, controller?:AbortController):Promise<ResultType> {
    return spinner(spinnerMessage, _cmd(cmdName, body, TIMEOUT, MAXRETRIES, controller));
}

/**
 * Wrap fetch with a timeout.
 * If provided, the given controller will be aborted if there is a network error.
 */
async function fetchWithTimeout(cmdName:string, body:BodyInit|undefined, timeout:number, controller?:AbortController):Promise<Response> {
    const controllerSafe = controller ?? new AbortController();
    const timeoutId = setTimeout(()=>{
        if (!controllerSafe.signal.aborted) {
            timeoutControllers.add(controllerSafe);
            controllerSafe.abort();
        }
    }, timeout);

    return fetch(`${SITE_ROOT}/api/${cmdName}.php`, {
        method: 'POST',
        mode: 'cors',
        signal: controllerSafe.signal,
        body
    }).catch((e:unknown)=>{
        if (!controllerSafe.signal.aborted) {
            controllerSafe.abort();
        }
        if ((e instanceof DOMException) && (e.name === 'AbortError')) {
            if (timeoutControllers.has(controllerSafe)) {
                throw new TimeoutError(`Command "${cmdName}" timed out`);
            }
        }
        throw e;
    }).finally(()=>{
        clearTimeout(timeoutId);
    });
}

/**
 * Wrap fetch to timeout and automatically retry.
 * If provided, the given controller is used only on the last retry.
 */
async function fetchWithTimeoutAndRetry(
    cmdName:string,
    body:BodyInit|undefined,
    timeout:number,
    maxRetries:number,
    controller?:AbortController
):Promise<Response> {
    let retriesLeft = maxRetries;
    while (retriesLeft > 0) {
        try {
            return await fetchWithTimeout(cmdName, body, timeout);
        } catch (e:unknown) {
            // ignore and try again
        }
        retriesLeft--;
    }
    return fetchWithTimeout(cmdName, body, timeout, controller);
}

/**
 * send a command to the server, await response
 */
async function _cmd<ResultType = unknown>(
    cmdName:string,
    body:BodyInit|undefined,
    timeout:number,
    maxRetries:number,
    controller?:AbortController
):Promise<ResultType> {
    const response = await fetchWithTimeoutAndRetry(
        cmdName,
        body,
        timeout,
        maxRetries,
        controller
    );

    if (!response.ok) {
        throw new Error(`${response.status}: (${response.type}) ${response.statusText}`);
    }

    let responseText;
    try {
        responseText = await response.text();
    } catch (error: unknown) {
        throw new Error(`Error reading server response.`);
    }

    try {
        return JSON.parse(responseText);
    } catch (error: unknown) {
        throw new Error(`Error parsing server response JSON.`);
    }
}
