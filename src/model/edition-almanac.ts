/**
 * Model for edition almanac data
 * @module EditionAlmanac
 */
import {Property} from '../bind/bindings';
import {ObservableObject, observableProperty} from '../bind/observable-object';

export class EditionAlmanac extends ObservableObject<EditionAlmanac> {
    @observableProperty('')
    readonly synopsis!:Property<string>;

    @observableProperty('')
    readonly overview!:Property<string>;

    @observableProperty('')
    readonly changelog!:Property<string>;
}
