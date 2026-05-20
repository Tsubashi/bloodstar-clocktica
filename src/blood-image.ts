/**
 * image processing for character tokens
 * @module ImageProcessing
 */
import {showErrorNoWait, show as showMessage} from './dlg/blood-message-dlg';
import { BloodTeam } from "./model/blood-team";
import Images from "./images";
import { getCorsProxyUrl } from "./util";
import Locks from './lock';
import { spinner } from './dlg/spinner-dlg';

const MAX_SIMULTANEOUS_IMAGE_REQUESTS = 8;

/** data about how clocktower.online wants the images */
export const enum ProcessImageSettings {
    FULL_WIDTH = 540,
    FULL_HEIGHT = 540,
    USABLE_REGION_CENTER_X = 270,
    USABLE_REGION_CENTER_Y = 184,
    USABLE_REGION_WIDTH = 300,
    USABLE_REGION_HEIGHT = 300,
}

/** cached results of urlToCanvas */
const urlToCanvasCache = new Map<string, Promise<HTMLCanvasElement>>();

/** options for urlToCanvas */
type UrlToCanvasOptions = {
    /** whether to allow caching of results (default: false) */
    cache?:boolean;

    /** whether to show a spinner popup while downloading (default: true) */
    showSpinner?:boolean; // TODO: would be cool to do a statusbar throbber if false
};

/** clamp and force to int */
function toByte(x:number):number { return Math.max(0, Math.min(255, x))|0; }

/** Gaussian function */
function gaussian(x:number, mu:number, sigma:number):number {
    const a = (x - mu) / sigma;
    return Math.exp(-0.5 * a * a);
}

/** create a convolution matrix for a gaussian blur */
function makeGaussianKernel(radius:number):number[][] {
    const sigma = radius / 2;
    const size = 2 * Math.ceil(radius) + 1;
    const result:number[][] = Array(size);
    let sum = 0;
    for (let y=0; y<size; ++y) {
        const row:number[] = Array(size);
        const g1 = gaussian(y, radius, sigma);
        for (let x=0; x<size; ++x) {
            const g2 = gaussian(x, radius, sigma);
            const a = g1*g2;
            row[x]=a;
            sum += a;
        }
        result[y] = row;
    }
    // normalize
    for (let y=0; y<size; ++y) {
        for (let x=0; x<size; ++x) {
            result[y][x] /= sum;
        }
    }
    return result;
}

/** wraps a canvas, providing convenient methods for customizing image */
export default class BloodImage {

    private canvas:HTMLCanvasElement;

    private ctx:CanvasRenderingContext2D;

    public get width() : number {
        return this.canvas.width;
    }

    public get height() : number {
        return this.canvas.height;
    }

    /** create BloodImage from canvas, image data, size, or data URI */
    constructor(imageData:HTMLCanvasElement|ImageData|[number, number]) {
        if (imageData instanceof HTMLCanvasElement) {
            this.canvas = imageData;
        } else {
            this.canvas = document.createElement('canvas');
        }

        const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) { throw new Error('Could not get CanvasRenderingContext2D'); }
        this.ctx = ctx;

        if (Array.isArray(imageData)) {
            [this.canvas.width, this.canvas.height] = imageData;
        } else if (imageData instanceof ImageData) {
            this.canvas.width = imageData.width;
            this.canvas.height = imageData.height;
            ctx.putImageData(imageData, 0, 0);
        }
    }

    /**
     * modifieds image in place
     * Adds a border along edges (based on alpha)
     */
    addBorder(intensity:number):void {
        if (intensity === 0) {
            this.alphaComposite(this.edgeDetect());
        } else {
            const overlay = this.edgeDetect().gaussianBlurChannel(3, intensity);

            // even though edge detect in theory left everything white, HTML canvas uses premultiplied alpha
            // and getting that color back out is lossy, so this has to change RGB to white as well
            if (intensity > 1) {
                overlay.transform((_r:number, _g:number, _b:number, a:number) => [
                    255,
                    255,
                    255,
                    toByte(255 * intensity * a / 255)]
                );
            }
            this.alphaComposite(overlay);
        }
    }

    /**
     * create a new image that looks like the original with a dropshadow effect
     */
    addDropShadow(size:number, offsetX:number, offsetY:number, opacity:number):BloodImage {
        let image = new BloodImage(this.ctx.getImageData(0, 0, this.width, this.height));
        image.setRGB(0, 0, 0);
        image = image
            .scaled(0.25)
            .gaussianBlur(size * 0.25)
            .scaled(4)
            .offset(offsetX, offsetY);
        image.transformChannel(3, alpha => opacity * alpha);
        image.alphaComposite(this);
        return image;
    }

    /**
     * Modifies image in place
     * paste other on top of this image
     */
    alphaComposite(other:BloodImage):void {
        this.ctx.drawImage(other.canvas, 0, 0);
    }

    /** create a new image that is the result of applying a convolution matrix to this image */
    convolve(kernel:number[][], channelMask=0xF):BloodImage {
        const kernelRows = kernel.length;
        if (kernelRows % 2 === 0) { throw new Error('convolve function expects the kernel dimensions to be odd'); }
        const kernelCols = kernel[0].length;
        if (kernelCols % 2 === 0) { throw new Error('convolve function expects the kernel dimensions to be odd'); }
        const xReach = (kernelCols / 2)|0;
        const yReach = (kernelRows / 2)|0;
        const destination = new BloodImage([this.width, this.height]);

        const dstImageData = destination.ctx.getImageData(0, 0, destination.width, destination.height);
        const dstPixels = dstImageData.data;
        const srcImageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const srcPixels = srcImageData.data;

        const w = this.width;
        const h = this.height;
        for (let dstY = 0; dstY < h; ++dstY) {
            for (let dstX = 0; dstX < w; ++dstX) {
                const dstI = (dstX + dstY * this.width) * 4;

                const pixel = [0, 0, 0, 0];

                // sum up values from src
                let weightSum = 0;
                for (let srcY = Math.max(0, dstY - yReach); srcY < Math.min(h, dstY + yReach); ++srcY) {
                    for (let srcX = Math.max(0, dstX - xReach); srcX < Math.min(w, dstX + xReach); ++srcX) {
                        const weight = kernel[srcY - dstY + yReach][srcX - dstX + xReach];
                        weightSum += weight;
                        const srcI = (srcX + srcY * w) * 4;
                        for (let channel = 0; channel<4; ++channel) {
                            pixel[channel] += weight * srcPixels[srcI + channel];
                        }
                    }
                }
                for (let channel = 0; channel<4; ++channel) {
                    pixel[channel] /= weightSum;
                }

                for (let channel = 0; channel<4; ++channel) {
                    dstPixels[dstI + channel] = (channelMask & (0x1 << channel)) ?
                        toByte(pixel[channel]) :
                        srcPixels[dstI + channel];
                }
            }
        }
        destination.ctx.putImageData(dstImageData, 0, 0);
        return destination;
    }

    /**
     * create a copy cropped to the given rectangle
     * @returns cropped copy of this
     */
    crop(x:number, y:number, w:number, h:number):BloodImage {
        return new BloodImage(this.ctx.getImageData(x, y, w, h));
    }

    /**
     * create a new image that has pixels visible only where an edge was detected in this
     * @returns new image
     */
    edgeDetect():BloodImage {
        const image = new BloodImage([this.width, this.height]);
        const srcImageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const srcPixels = srcImageData.data;
        const dstImageData = image.ctx.getImageData(0, 0, this.width, this.height);
        const dstPixels = dstImageData.data;
        const w = this.width;
        const h = this.height;
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                const i = (x + y * this.width) * 4;
                const thisAlpha = srcPixels[i + 3];
                let edgeFound = false;
                for (let y2 = Math.max(0, y-1); y2 < Math.min(h, y+2) && !edgeFound; ++y2) {
                    for (let x2 = Math.max(0, x-1); x2 < Math.min(w, x+2) && !edgeFound; ++x2) {
                        const i2 = (x2 + y2 * this.width) * 4;
                        const neighborAlpha = srcPixels[i2 + 3];
                        if ((thisAlpha > 127) !== (neighborAlpha > 127)) {
                            edgeFound = true;
                        }
                    }
                }

                dstPixels[i + 0] = 255;
                dstPixels[i + 1] = 255;
                dstPixels[i + 2] = 255;
                dstPixels[i + 3] = edgeFound ? 255 : 0;
            }
        }

        image.ctx.putImageData(dstImageData, 0, 0);
        return image;
    }

    /**
     * resize, adding extra spacing to preserve the aspect ratio
     * @returns a new BloodImage
     */
    fit(width:number, height:number):BloodImage {
        return new BloodImage([width, height]).pasteZoomed(this, 0, 0, width, height);
    }

    /** careate a new image by blurring this one */
    gaussianBlur(radius:number):BloodImage {
        return this.convolve(makeGaussianKernel(radius));
    }

    /** create a new image by blurring one channel of the image */
    gaussianBlurChannel(channel:number, radius:number):BloodImage {
        return this.convolve(makeGaussianKernel(radius), 0x1 << channel);
    }

    /** get [x,y,width,height] describing region of image with visible pixels */
    getBoundingBox():[number, number, number, number] {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const pixels = imageData.data;
        let left = imageData.width;
        let top = imageData.height;
        let right = 0;
        let bottom = 0;
        for (let y = 0; y < imageData.height; ++y) {
            for (let x = 0; x < imageData.width; ++x) {
                const i = (x + y * imageData.width) * 4;
                const alpha = pixels[i + 3];
                if (alpha > 0) {
                    left = Math.min(left, x);
                    top = Math.min(top, y);
                    right = Math.max(right, x);
                    bottom = Math.max(bottom, y);
                }
            }
        }
        if (right <= left) {
            left = right = top = bottom = 0;
        }
        return [left, top, right-left, bottom-top];
    }

    /**
     * Modifies the BloodImage in place!
     * mutliply-blends in the specified image
     */
    multiply(mult:BloodImage):void {
        const dstImageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const dstPixels = dstImageData.data;
        const multImageData = mult.ctx.getImageData(0, 0, this.width, this.height);
        const multPixels = multImageData.data;
        const w = Math.min(dstImageData.width, multImageData.width);
        const h = Math.min(dstImageData.height, multImageData.height);
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                const effectScale = multPixels[(x + y * multImageData.width) * 4 + 3] / 255;
                for (let channel = 0; channel < 3; ++channel) {
                    const dstIndex = (x + y * dstImageData.width) * 4 + channel;
                    const srcIndex = (x + y * multImageData.width) * 4 + channel;
                    const oldValue = dstPixels[dstIndex];
                    const multValue = oldValue * multPixels[srcIndex] / 255;
                    dstPixels[dstIndex] = toByte(oldValue + effectScale * (multValue - oldValue));
                }
            }
        }
        this.ctx.putImageData(dstImageData, 0, 0);
    }

    /** create a new image by offsetting the pixels in this one */
    offset(x:number, y:number):BloodImage {
        const destination = new BloodImage([this.width, this.height]);
        destination.ctx.drawImage(this.canvas, x, y);
        return destination;
    }

    /**
     * modify this in place
     * @param source what to paste
     * @param x paste location left
     * @param y paste location top
     * @param w paste location width
     * @param h paste location height
     * @returns this
     */
    pasteZoomed(source:BloodImage, x:number, y:number, w:number, h:number):this {
        if ((source.width === 0)||(source.height === 0)||(w === 0)||(h === 0)) {return this;}
        const sourceAspect = source.width / source.height;
        const destinationAspect = w/h;
        let dstX = x;
        let dstY = y;
        let dstW = w;
        let dstH = h;
        if (sourceAspect > destinationAspect) {
            const newH = Math.floor(w / sourceAspect);
            const extraSpace = h - newH;
            dstY += extraSpace / 2;
            dstH -= extraSpace;
        } else {
            const newW = Math.floor(h * sourceAspect);
            const extraSpace = w - newW;
            dstX += extraSpace / 2;
            dstW -= extraSpace;
        }
        this.ctx.drawImage(source.canvas, dstX, dstY, dstW, dstH);
        return this;
    }

    /**
     * create a resized copy of the image
     * @param w new width
     * @param h new height
     * @returns a resized copy of the image
     */
    resized(w:number, h:number):BloodImage {
        const result = new BloodImage([w, h]);
        result.ctx.drawImage(this.canvas, 0, 0, w, h);
        return result;
    }

    /**
     * create a scaled copy of the image
     * @param w new width
     * @param h new height
     * @returns a resized copy of the image
     */
    scaled(scaleFactor:number):BloodImage {
        const result = new BloodImage([this.width * scaleFactor, this.height * scaleFactor]);
        result.ctx.drawImage(this.canvas, 0, 0, result.width, result.height);
        return result;
    }

    /**
     * Modifies the BloodImage in place!
     * set red, green, and blue components of image to fixed values, leaving alpha alone
     */
    setRGB(red:number, green:number, blue:number):void {
        const redByte = toByte(red);
        const greenByte = toByte(green);
        const blueByte = toByte(blue);
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const pixels = imageData.data;
        for (let y = 0; y < imageData.height; ++y) {
            for (let x = 0; x < imageData.width; ++x) {
                const i = (x + y * imageData.width) * 4;
                pixels[i + 0] = redByte;
                pixels[i + 1] = greenByte;
                pixels[i + 2] = blueByte;
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }

    /**
     * convert blood image contents to a data uri
     * @returns image encoded as string
     */
    toDataUri():string {
        return this.canvas.toDataURL('image/png');
    }

    /**
     * edit channel values in place
     */
    transformChannel(channel:number, cb:(x:number)=>number):void {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const pixels = imageData.data;

        const w = this.width;
        const h = this.height;
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                const i = (x + y * this.width) * 4;
                pixels[i + channel] = toByte(cb(pixels[i + channel]));
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }

    /** edit pixel values in place */
    transform(cb:(r:number, g:number, b:number, a:number)=>[number, number, number, number]):void {
        const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
        const pixels = imageData.data;

        const w = this.width;
        const h = this.height;
        for (let y = 0; y < h; ++y) {
            for (let x = 0; x < w; ++x) {
                const i = (x + y * this.width) * 4;
                const [r, g, b, a] = cb(
                    pixels[i + 0],
                    pixels[i + 1],
                    pixels[i + 2],
                    pixels[i + 3]
                );
                pixels[i + 0] = toByte(r);
                pixels[i + 1] = toByte(g);
                pixels[i + 2] = toByte(b);
                pixels[i + 3] = toByte(a);
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }

    /**
     * create a copy cropped to visible pixels
     * @returns cropped copy of this
     */
    trim():BloodImage {
        return this.crop(...this.getBoundingBox());
    }
}

/** get BloodImage from url */
// TODO: move size into options object
export async function urlToBloodImage(url:string, maxWidth:number, maxHeight:number, options?:UrlToCanvasOptions):Promise<BloodImage> {
    const canvas = await urlToCanvas(url, maxWidth, maxHeight, options);
    return new BloodImage(canvas);
}

/** get image data from the url and convert it to a dataUri, throttled */
export async function imageUrlToDataUri(url:string, showSpinner=true):Promise<string> {
    const sourceUrl = new URL(url, location.origin);
    const useCors = sourceUrl.hostname !== window.location.hostname;
    return Locks.enqueue('imageRequest', async ()=>_imageUrlToDataUri(url, useCors, showSpinner), MAX_SIMULTANEOUS_IMAGE_REQUESTS);
}

/** used to limit messages about download errors */
let blockErrorMessages = false;

/** get image data from the url and convert it to a dataUri */
export async function _imageUrlToDataUri(url:string, useCorsProxy:boolean, showSpinner=true):Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(()=>{
        if (!controller.signal.aborted) {
            controller.abort();
            showErrorNoWait('Network Error', `Request timed out trying to reach ${url}`);
        }
    }, 30*1000);
    try {
        const proxiedUrl = useCorsProxy ? getCorsProxyUrl(url) : url;
        const fetchPromise = fetch(proxiedUrl, {
            method:'GET',
            mode: 'cors',
            signal: controller.signal
        });
        const response = await (showSpinner ? spinner(`Downloading ${url}`, fetchPromise) : fetchPromise);
        if (!response.ok) {
            // intentional floating promise - TODO: something to prevent getting many of these at once
            if (!blockErrorMessages) {
                const msgPromise = showMessage('Network Error', `Something went wrong while trying to reach ${url}`);
                blockErrorMessages = true;
                msgPromise.finally(()=>{blockErrorMessages=false;});
            }
            console.error(`Trying to reach ${proxiedUrl}\n${response.status}: (${response.type}) ${response.statusText}`);
            return '';
        }
        const buffer = await response.arrayBuffer();
        const reader = new FileReader();
        return await new Promise((resolve)=>{
            reader.onload = ()=>{
                const base64 = reader.result ?? '';
                resolve(base64 as string);
            };
            reader.readAsDataURL(new Blob([buffer]));
        });
    } finally {
        clearTimeout(timeoutId);
    }
}

/** get image data from the url and put it in a new canvas */
export async function urlToCanvas(url:string, width:number, height:number, options?:UrlToCanvasOptions):Promise<HTMLCanvasElement> {
    const shouldCache = url.startsWith('data:') || !(options?.cache ?? false);
    const workFn = async ()=>_urlToCanvas(url, width, height, options);

    // when caching the image, we don't want two downloads of the same thing going at once
    return shouldCache ? workFn() : Locks.enqueue(`urlToCanvas ${url}`, workFn);
}

/** does the work of urlToCanvas */
export async function _urlToCanvas(url:string, width:number, height:number, options?:UrlToCanvasOptions):Promise<HTMLCanvasElement> {
    const sourceUrl = new URL(url, location.origin);
    const isDataUri = sourceUrl.protocol === 'data:';
    const shouldCache = !isDataUri && (options?.cache ?? false);
    const memoKey = shouldCache ? [url, width, height].join(' ') : '';

    // early exit with the cached version if possible
    if (shouldCache) {
        const cached = urlToCanvasCache.get(memoKey);
        if (cached) {
            return cached;
        }
    }

    const showSpinner = options?.showSpinner ?? true;
    const dataUri = isDataUri ? url : await imageUrlToDataUri(url, showSpinner);
    const image = new Image();
    const canvas = document.createElement('canvas');

    const canvasPromise = new Promise<HTMLCanvasElement>((resolve, reject)=>{
        image.onload = function() {
            const scale = Math.min(1.0, width / image.width, height / image.height);
            canvas.width = (scale * image.width) | 0;
            canvas.height = (scale * image.height) | 0;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                resolve(canvas);
            } else {
                reject(new Error('no context 2d'));
            }
        };
        image.onerror = ()=>{ reject(new Error(`Failed to load image "${url}"`)); };
        image.src = dataUri;
    });

    // cache and return (but no caching for dataUris)
    if (shouldCache) { urlToCanvasCache.set(memoKey, canvasPromise); }
    return canvasPromise;
}

/** find the appropriate gradient image for the team and settings */
export async function getGradientForTeam(team:BloodTeam, useOutsiderAndMinionColors:boolean):Promise<BloodImage> {
    let url:string;
    switch (team) {
        case BloodTeam.TOWNSFOLK:
            url = Images.TOWNSFOLK_GRADIENT_URL;
            break;
        case BloodTeam.OUTSIDER:
            url = useOutsiderAndMinionColors ? Images.OUTSIDER_GRADIENT_URL : Images.TOWNSFOLK_GRADIENT_URL;
            break;
        case BloodTeam.MINION:
            url = useOutsiderAndMinionColors ? Images.MINION_GRADIENT_URL : Images.DEMON_GRADIENT_URL;
            break;
        case BloodTeam.DEMON:
            url = Images.DEMON_GRADIENT_URL;
            break;
        case BloodTeam.TRAVELLER:
            url = Images.TRAVELLER_GRADIENT_URL;
            break;
        case BloodTeam.FABLED:
            url = Images.FABLED_GRADIENT_URL;
            break;
        case BloodTeam.JINXES:
            url = Images.JINXES_GRADIENT_URL;
            break;
        case BloodTeam.LORIC:
            url = Images.LORIC_GRADIENT_URL;
            break;
        default:
            throw new Error(`getGradientForTeam: unhandled team "${team}"`);
    }

    return urlToBloodImage(url, ProcessImageSettings.FULL_WIDTH, ProcessImageSettings.FULL_HEIGHT, {cache:true, showSpinner:false});
}