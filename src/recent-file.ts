/**
 * code to manage remembering last used file
 * @module RecentFile
 */

/**
 * If a file turns out to be deleted or renamed or something, delete the old
 * name from the list
 * @param name file name to remove
 */
export function clearRecentFile(name:string):void {
    try {
        const {localStorage} = window;
        const file = localStorage.getItem('recentFile');
        if (file!==name) {return;}
        localStorage.removeItem('recentFile');
    } catch {
        // ignore
    }
}

/**
 * if a last-opened file is remembered, get its name
 * otherwise, return the empty string
 */
export function getRecentFile(userEmail:string):string {
    if (userEmail !== localStorage.getItem('recentFileUser')) {
        return '';
    }
    try {
        const {localStorage} = window;
        return localStorage.getItem('recentFile') ?? '';
    } catch {
        // ignore
    }
    return '';
}

/**
 * maintain a list of recent files - both in the menu and in local storage
 * @param name file name
 */
export function setRecentFile(name:string, userEmail:string):void {
    try {
        const {localStorage} = window;
        localStorage.setItem('recentFile', name);
        localStorage.setItem('recentFileUser', userEmail);
    } catch {
        // ignore
    }
}