/**
 * one configurable function to replace what was previously a lot of dupe code around running commands
 * @module GenericCmd
 */
import { SessionInfo } from '../iam';
import signIn, { accessTokenExpired, getStoredToken, SignInOptions } from '../sign-in';
import cmd from '../commands/cmd';
import { showError } from '../dlg/blood-message-dlg';
import { show as getConfirmation, YesNoOptions } from '../dlg/yes-no-dlg';

/** options to genericCmd */
export type GenericCmdOptions<RequestType> = {
    /**
     * command to run. required
     */
    command:string;

    /**
     * If provided, a confirmation popup using these options will be shown after signing in.
     */
    confirmOptions?:YesNoOptions;

    /**
     * provide an abort controller to make the command cancellable
     */
    controller?:AbortController;

    /**
     * Whether to catch exceptions and bring up an error message for them.
     * (default: true)
     */
    handleError?:boolean;

    /**
     * Message to use in error messages or function to build it.
     * Not used if handleError is false.
     * (default: generic message)
     */
    errorMessage?:string | (()=>string);

    /**
     * Request object to use with the command, or function to call to make it.
     * Can't be a function if signIn is false.
     * Required.
     */
    request:RequestType | ((s:SessionInfo|null)=>RequestType);

    /**
     * false to not require sign in.
     * (default: true)
     */
    signIn?:SignInOptions;

    /**
     * Message to show during the 'please wait' popup.
     * Required.
     */
    spinnerMessage:string;
};

export type ErrorReason = {error:string};
export type CancelReason = {cancel: 'declined' | 'signInFailed'};
type CmdResult<ResponseDataType> = ResponseDataType | 'signInRequired' | {error:unknown};
type GenericCmdReturn<ResponseDataType> = CancelReason | ErrorReason | {data:ResponseDataType};

/**
 * handle common operations around running a command
 */
export default async function genericCmd<
    RequestType extends {token:string},
    ResponseDataType
>(options:GenericCmdOptions<RequestType>):Promise<GenericCmdReturn<ResponseDataType>> {
    const response = await runCmd<RequestType, ResponseDataType>(options);
    if ('cancel' in response) {return response;}
    if (('error' in response) && (options.handleError ?? true)) {
        const safeErrorMessage = (typeof options.errorMessage === 'function') ?
            options.errorMessage() :
            options.errorMessage;
        await showError('Network Error', safeErrorMessage, response.error);
    }
    return response;
}

/**
 * run a command based on GenericCmdOptions
 */
async function runCmd<
    RequestType extends {token:string},
    ResponseDataType
>(options:GenericCmdOptions<RequestType>):Promise<GenericCmdReturn<ResponseDataType>> {
    let response:CmdResult<ResponseDataType>;
    if (options.signIn) {
        let sessionInfo = getStoredToken();
        if (!sessionInfo || accessTokenExpired(sessionInfo)) {
            sessionInfo = await signIn(options.signIn);
        }
        if (!sessionInfo) {return {cancel:'signInFailed'};}
        if (options.confirmOptions && !await getConfirmation(options.confirmOptions)) { return {cancel:'declined'}; }
        const requestSafe = (typeof options.request === 'function') ? options.request(sessionInfo) : options.request;
        response = await cmd<CmdResult<ResponseDataType>>(options.command, options.spinnerMessage, JSON.stringify(requestSafe), options.controller);
        while (response === 'signInRequired') {
            sessionInfo = await signIn(options.signIn);
            if (!sessionInfo) {return {cancel:'signInFailed'};}
            requestSafe.token = sessionInfo.token;
            response = await cmd<CmdResult<ResponseDataType>>(options.command, options.spinnerMessage, JSON.stringify(requestSafe), options.controller);
        }
    } else {
        const requestSafe = (typeof options.request === 'function') ? options.request(null) : options.request;
        response = await cmd<CmdResult<ResponseDataType>>(options.command, options.spinnerMessage, JSON.stringify(requestSafe), options.controller);
    }
    if (response === 'signInRequired') {return {cancel:'signInFailed'};}
    if (response && (typeof response === 'object') && ('error' in response)) {
        return {error:String(response.error)};
    }
    return {data:response};
}