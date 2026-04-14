/**
 * shared code for validating data
 * @module Validate
 */

import { createElement } from "./util";

const VALID_URL_PART = /^[A-Za-z0-9\-_]+$/;

// this regex comes from the HTML5 spec https://html.spec.whatwg.org/multipage/input.html#e-mail-state-(type%3Demail)
// this does reject technically-valid email addresses but it handles the sort I care to support with this app
const VALID_EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** update container contents to warn if email does not look valid */
export function updateEmailWarnings(email:string, container:HTMLElement):void {
    container.innerText = '';
    if (!validateEmail(email)) {
        container.appendChild(createElement({t:'span', txt:`× Invalid email`}));
    }
}

/** update container contents to warn if any password requirement is not met */
export function updatePasswordWarnings(password:string, passwordConfirm:string, container:HTMLElement):void {
    container.innerText = '';
    function warn(txt:string) {container.appendChild(createElement({t:'span', txt:`× ${txt}`}));}
    if (password.length < 8) {warn('Password must contain at least 8 characters');}
    if (password.length < 24) {
        if (!/[a-z]/.test(password)) {warn('Passwords, if short, must contain a lower case letter');}
        if (!/[A-Z]/.test(password)) {warn('Passwords, if short, must contain an upper case letter');}
        if (!/[0-9]/.test(password)) {warn('Passwords, if short, must contain a number');}
    }
    if (password !== passwordConfirm) {warn(`Passwords must match`);}
}

/** update container contents to warn if save name does not look valid */
export function updateSaveNameWarnings(name:string, container:HTMLElement, fieldName:string):void {
    updateUsernameWarnings(name, container, fieldName);
}

/** update container contents to warn if username does not look valid */
export function updateUsernameWarnings(username:string, container:HTMLElement, fieldName:string):void {
    container.innerText = '';
    if (username.length < 2) {
        container.appendChild(createElement({t:'span', txt:`× ${fieldName} too short`}));
    }
    if (!VALID_URL_PART.test(username)) {
        container.appendChild(createElement({t:'span', txt:`× ${fieldName} should contain only letters, numbers, hyphens (-), and underscores (_)`}));
    }
}

/** test email */
export function validateEmail(email:string):boolean {
    return VALID_EMAIL_RE.test(email);
}

/** test all the password requirements */
export function validatePassword(password:string):boolean {
    if (password.length < 8) {return false;}
    if (password.length < 24) {
        if (!/[a-z]/.test(password)) {return false;}
        if (!/[A-Z]/.test(password)) {return false;}
        if (!/[0-9]/.test(password)) {return false;}
    }
    return true;
}

/** check that the save name looks valid */
export function validateSaveName(name:string):boolean {
    return validateUsername(name);
}

/** check that the username looks valid */
export function validateUsername(username:string):boolean {
    return VALID_URL_PART.test(username);
}