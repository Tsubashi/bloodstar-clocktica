/**
 * enum and related functions for working with (currently vaguely defined) "special" abilities of characters
 * @module Special
 */
export enum BloodSpecial {
    NONE = 'none',
    SHOW_GRIMOIRE = 'showGrimoire',
    POINT = 'point',
    NONE_DISPLAY = 'None',
    SHOW_GRIMOIRE_DISPLAY = 'Show Grimoire',
    POINT_DISPLAY = 'Point'
}

/** convert a string to a BloodSpecial enum */
export function parseSpecial(s:string):BloodSpecial {
    switch (s.toLowerCase())
    {
        case 'none':
            return BloodSpecial.NONE;
        case 'showgrimoire':
            return BloodSpecial.SHOW_GRIMOIRE;
        case 'point':
            return BloodSpecial.POINT;
        default:
            throw new Error(`parseSpecial: unhandled value "${s}"`);
    }
}

/** special options prepared for use with a EnumProperty */
export const SPECIAL_OPTIONS:readonly {display:string; value:BloodSpecial}[] = [
    {display: BloodSpecial.NONE_DISPLAY, value: BloodSpecial.NONE},
    {display: BloodSpecial.SHOW_GRIMOIRE_DISPLAY, value: BloodSpecial.SHOW_GRIMOIRE},
    {display: BloodSpecial.POINT_DISPLAY, value: BloodSpecial.POINT}
];