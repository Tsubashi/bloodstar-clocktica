/**
 *
 * @Module TeamColor
 */

import { BloodTeam } from "./model/blood-team";

/** map teams to css classes */
const teamColorStyleMap = new Map<BloodTeam, string>([
    [BloodTeam.TOWNSFOLK, 'teamColorTownsfolk'],
    [BloodTeam.OUTSIDER, 'teamColorOutsider'],
    [BloodTeam.MINION, 'teamColorMinion'],
    [BloodTeam.DEMON, 'teamColorDemon'],
    [BloodTeam.TRAVELLER, 'teamColorTraveller'],
    [BloodTeam.FABLED, 'teamColorFabled'],
    [BloodTeam.JINXES, 'teamColorJinxes'],
]);

/** sync team color style to the actual team */
export function setTeamColorStyle(actualTeam:BloodTeam, classList:DOMTokenList):void {
    for (const [team, style] of teamColorStyleMap) {
        if (actualTeam === team) {
            classList.add(style);
        } else {
            classList.remove(style);
        }
    }
}