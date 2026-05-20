/**
 * enum and related functions for working with Blood on the Clocktower teams
 * @module BloodTeam
 */
export enum BloodTeam {
    TOWNSFOLK = 'townsfolk',
    OUTSIDER = 'outsider',
    MINION = 'minion',
    DEMON = 'demon',
    TRAVELLER = 'traveller',
    FABLED = 'fabled',
    JINXES = 'jinxes',
    LORIC = 'loric',
    TOWNSFOLK_DISPLAY = 'Townsfolk',
    OUTSIDER_DISPLAY = 'Outsider',
    MINION_DISPLAY = 'Minion',
    DEMON_DISPLAY = 'Demon',
    TRAVELLER_DISPLAY = 'Traveller',
    FABLED_DISPLAY = 'Fabled',
    JINXES_DISPLAY = 'Jinxes',
    LORIC_DISPLAY = 'Loric',
}

/** convert a string to a BloodTeam enum */
export function parseBloodTeam(s:string):BloodTeam {
    switch (s.toLowerCase())
    {
        case "townsfolk":
            return BloodTeam.TOWNSFOLK;
        case "outsider":
            return BloodTeam.OUTSIDER;
        case "minion":
            return BloodTeam.MINION;
        case "demon":
            return BloodTeam.DEMON;
        case "traveller":
        case "traveler":
            return BloodTeam.TRAVELLER;
        case 'fabled':
            return BloodTeam.FABLED;
        case 'jinxes':
            return BloodTeam.JINXES;
        case 'loric':
            return BloodTeam.LORIC;
        default:
            throw new Error(`parseBloodTeam: unhandled team ${s}`);
    }
}

/** blood team options prepared for use with a EnumProperty */
export const BLOODTEAM_OPTIONS:readonly {display:string; value:BloodTeam}[] = [
    {display: BloodTeam.TOWNSFOLK_DISPLAY, value: BloodTeam.TOWNSFOLK},
    {display: BloodTeam.OUTSIDER_DISPLAY, value: BloodTeam.OUTSIDER},
    {display: BloodTeam.MINION_DISPLAY, value: BloodTeam.MINION},
    {display: BloodTeam.DEMON_DISPLAY, value: BloodTeam.DEMON},
    {display: BloodTeam.TRAVELLER_DISPLAY, value: BloodTeam.TRAVELLER},
    {display: BloodTeam.FABLED_DISPLAY, value: BloodTeam.FABLED},
    {display: BloodTeam.JINXES_DISPLAY, value: BloodTeam.JINXES},
    {display: BloodTeam.LORIC_DISPLAY, value: BloodTeam.LORIC}
];

/** convert BloodTeam enum to a display string */
export function bloodTeamDisplayString(team:BloodTeam):string {
    switch (team.toLowerCase())
    {
        case "townsfolk":
            return BloodTeam.TOWNSFOLK_DISPLAY;
        case "outsider":
            return BloodTeam.OUTSIDER_DISPLAY;
        case "minion":
            return BloodTeam.MINION_DISPLAY;
        case "demon":
            return BloodTeam.DEMON_DISPLAY;
        case "traveller":
        case "traveler":
            return BloodTeam.TRAVELLER_DISPLAY;
        case 'fabled':
            return BloodTeam.FABLED_DISPLAY;
        case 'jinxes':
            return BloodTeam.JINXES_DISPLAY;
        case 'loric':
            return BloodTeam.LORIC_DISPLAY;
        default:
            throw new Error(`bloodTeamDisplayString: unhandled team ${team}`);
    }
}