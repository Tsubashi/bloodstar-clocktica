/**
 * Model for edition metadata
 * @module EditionMeta
 */
import {Property} from '../bind/bindings';
import {ObservableObject, observableProperty} from '../bind/observable-object';

export class EditionMeta extends ObservableObject<EditionMeta> {
    /** who to credit for the edition */
    @observableProperty('')
    readonly author!:Property<string>;

    /** logo image for the edition */
    @observableProperty(null)
    readonly logo!:Property<string|null>;

    /** what the edition is called */
    @observableProperty('New Edition', {saveDefault:true})
    readonly name!:Property<string>;
}
