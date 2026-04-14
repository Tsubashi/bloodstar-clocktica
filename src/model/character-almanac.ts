/**
 * Model for character almanac data
 * @module CharacterAlmanac
 */
import {Property} from '../bind/bindings';
import {ObservableObject, observableProperty} from '../bind/observable-object';

export class CharacterAlmanac extends ObservableObject<CharacterAlmanac> {
    @observableProperty('')
    readonly examples!: Property<string>;

    @observableProperty('')
    readonly flavor!: Property<string>;

    @observableProperty('')
    readonly howToRun!: Property<string>;

    @observableProperty('')
    readonly overview!: Property<string>;

    @observableProperty('')
    readonly tip!: Property<string>;
}
