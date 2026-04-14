/**
 * Model for character data
 * @module Character
 */
import {CharacterAlmanac} from './character-almanac';
import {EnumProperty, Property} from '../bind/bindings';
import {observableChild, observableEnumProperty, ObservableObject, observableProperty} from '../bind/observable-object';
import {BloodTeam, BLOODTEAM_OPTIONS} from '../model/blood-team';
import {CharacterImageSettings} from '../model/character-image-settings';
import BloodImage, { getGradientForTeam, imageUrlToDataUri, ProcessImageSettings, urlToBloodImage } from '../blood-image';
import Images from '../images';
import { BloodSpecial, SPECIAL_OPTIONS } from './special';

export class Character extends ObservableObject<Character> {
    @observableProperty('')
    readonly ability!: Property<string>;

    @observableProperty('')
    readonly attribution!: Property<string>;

    @observableProperty('')
    readonly notes!: Property<string>;

    @observableChild(CharacterAlmanac)
    readonly almanac!: CharacterAlmanac;

    @observableProperty('')
    readonly characterReminderTokens!: Property<string>;

    @observableProperty(true)
    readonly export!: Property<boolean>;

    @observableProperty('-', { read: false, write: false })
    readonly firstNightOrdinal!: Property<string>;

    @observableProperty('')
    readonly firstNightReminder!:Property<string>;

    @observableProperty('')
    readonly globalReminderTokens!:Property<string>;

    @observableProperty('newcharacter', {saveDefault:true})
    readonly id!: Property<string>;

    @observableChild(CharacterImageSettings)
    readonly imageSettings!: CharacterImageSettings;

    @observableProperty('New Character', {saveDefault:true})
    readonly name!: Property<string>;

    @observableProperty('-', {read:false, write:false})
    readonly otherNightOrdinal!:Property<string>;

    @observableProperty('')
    readonly otherNightReminder!:Property<string>;

    @observableProperty(false)
    readonly setup!:Property<boolean>;

    @observableProperty(null)
    readonly styledImage!: Property<string | null>;

    @observableEnumProperty(BloodTeam.TOWNSFOLK, BLOODTEAM_OPTIONS, {saveDefault:true})
    readonly team!: EnumProperty<BloodTeam>;

    @observableProperty(null)
    readonly unStyledImage!: Property<string | null>;

    @observableProperty(false, {read:false, write:false})
    readonly isLoading!: Property<boolean>;

    @observableEnumProperty(BloodSpecial.NONE, SPECIAL_OPTIONS)
    readonly special!: EnumProperty<BloodSpecial>;

    /** prevent extraneous image processing during deserialization */
    private imageRegenSuspended = false;

    private constructor() {
        super();
        const regenCb = async ()=>this.regenerateStyledImage();
        this.imageSettings.addPropertyChangedEventListener(regenCb);
        this.unStyledImage.addListener(regenCb);
        this.team.addListener(regenCb);

        // IF source or styled image are url paths instead of data uris,
        // THEN id change should force a regen, because that path is probably based on id
        this.id.addListener(async ()=>{
            const unstyled = this.unStyledImage.get();
            if (unstyled === null) { return; }
            // when the id changes, remote path is no longer good, so convert to dataUri
            if (!unstyled.startsWith('data:')) {
                await this.unStyledImage.set(await imageUrlToDataUri(unstyled, false));
                return;
            }
            // similar for styled image
            const styled = this.styledImage.get();
            if (styled === null) {
                await this.regenerateStyledImage();
                return;
            }
            if (!styled.startsWith('data:')) {
                await this.styledImage.set(await imageUrlToDataUri(styled, false));
            }
        });
    }

    static async asyncNew():Promise<Character> {
        const character = new Character();
        // set up auto-regen of styled images
        await character.regenerateStyledImage();
        return character;
    }

    async deserialize(data:Record<string, unknown>):Promise<void> {
        this.imageRegenSuspended = true;
        await super.deserialize(data);
        this.imageRegenSuspended = false;
    }

    /** generate styled image from unstyled image and image settings */
    async regenerateStyledImage():Promise<void> {
        if (this.imageRegenSuspended) {return;}
        try {
            await this.isLoading.set(true);
            await this._regenerateStyledImage();
        } catch (error: unknown) {
            await this.styledImage.set('');
            throw error;
        } finally {
            await this.isLoading.set(false);
        }
    }

    /** generate styled image from unstyled image and image settings */
    async _regenerateStyledImage():Promise<void> {
        const unstyledImage = this.unStyledImage.get();
        const {imageSettings} = this;
        if (!unstyledImage || !imageSettings.shouldRestyle.get()) {
            return this.styledImage.set(unstyledImage);
        }

        // start from the unstyled image
        let bloodImage = await urlToBloodImage(unstyledImage, ProcessImageSettings.FULL_WIDTH, ProcessImageSettings.FULL_HEIGHT, {cache:false, showSpinner:false});

        // crop
        if (imageSettings.shouldCrop.get()) {
            bloodImage = bloodImage.trim();
        }

        if (bloodImage.width === 0) {return this.styledImage.set(null);}
        if (bloodImage.height === 0) {return this.styledImage.set(null);}

        // colorize
        if (imageSettings.shouldColorize.get()) {
            const gradientImage = await getGradientForTeam(
                this.team.get(),
                imageSettings.useOutsiderAndMinionColors.get()
            );
            bloodImage.setRGB(255, 255, 255);
            bloodImage.multiply(gradientImage.resized(bloodImage.width, bloodImage.height));
        }

        // make full size image with icon pasted into the correct place
        const srcW = bloodImage.width;
        const srcH = bloodImage.height;
        const aspect = srcW / srcH;
        let dstW = ProcessImageSettings.FULL_WIDTH * imageSettings.sizeFactor.get();
        let dstH = ProcessImageSettings.FULL_HEIGHT * imageSettings.sizeFactor.get();
        if (aspect > 1.0) {
            dstH = dstW / aspect;
        } else {
            dstW = dstH * aspect;
        }
        const dstX = (ProcessImageSettings.FULL_WIDTH - dstW) * imageSettings.horizontalPlacement.get();
        const dstY = (ProcessImageSettings.FULL_HEIGHT - dstH) * imageSettings.verticalPlacement.get();

        bloodImage =
            new BloodImage([ProcessImageSettings.FULL_WIDTH, ProcessImageSettings.FULL_HEIGHT])
                .pasteZoomed(bloodImage, dstX, dstY, dstW, dstH);

        // texture
        if (imageSettings.useTexture.get()) {
            const tokenTexture = await urlToBloodImage(Images.TEXTURE_URL, ProcessImageSettings.FULL_WIDTH, ProcessImageSettings.FULL_HEIGHT, {cache:true, showSpinner:false});
            bloodImage.multiply(tokenTexture);
        }

        // border
        if (imageSettings.useBorder.get()) {
            bloodImage.addBorder(imageSettings.borderIntensity.get());
        }

        // dropshadow
        if (imageSettings.useDropshadow.get()) {
            bloodImage = bloodImage.addDropShadow(
                imageSettings.dropShadowSize.get(),
                imageSettings.dropShadowOffsetX.get(),
                imageSettings.dropShadowOffsetY.get(),
                imageSettings.dropShadowOpacity.get());
        }
        return this.styledImage.set(bloodImage.toDataUri());
    }
}
