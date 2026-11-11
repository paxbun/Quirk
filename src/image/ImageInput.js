/** Classical image input shared by formula gates. No quantum state is copied. */
class ImageInput {
    constructor() {
        this.size = 4;
        this.pixels = new Float64Array(16);
        this.source28 = undefined;
        this.revision = 0;
        this.active = false;
        this.listeners = new Set();
    }
    getPixel(row, column) {
        if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= this.size || column >= this.size) {
            throw new Error(`m(row,column) needs integer indices from 0 to ${this.size-1}.`);
        }
        return this.pixels[row*this.size+column];
    }
    setPixels(size, pixels, source28=undefined) {
        if (!Number.isInteger(size) || size < 2 || size > 28 || pixels.length !== size*size ||
                Array.from(pixels).some(v => !Number.isFinite(v) || v < 0 || v > 1)) {
            throw new Error('M needs a 2–28 square array of finite values in [0,1].');
        }
        if (source28 !== undefined && (source28.length !== 784 || Array.from(source28).some(v => !Number.isInteger(v) || v < 0 || v > 255))) {
            throw new Error('M source image must contain 784 bytes.');
        }
        this.size = size;
        this.pixels = Float64Array.from(pixels);
        this.source28 = source28 === undefined ? undefined : Array.from(source28);
        this.active = true;
        this.revision++;
        for (let listener of this.listeners) { listener(this); }
    }
    snapshot() {
        return {size: this.size, pixels: Array.from(this.pixels), source28: this.source28};
    }
    restore(snapshot) {
        if (snapshot === undefined) {
            if (!this.active) { return; }
            this.setPixels(4, new Float64Array(16));
            this.active = false;
        } else {
            if (JSON.stringify(snapshot) === JSON.stringify(this.snapshot()) && this.active) { return; }
            this.setPixels(snapshot.size, snapshot.pixels, snapshot.source28);
        }
    }
    subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    setCanvas(canvas, size) {
        if (!Number.isInteger(size) || size < 2 || size > 28) { throw new Error('M canvas size must be an integer from 2 to 28.'); }
        let normalized = resizeCanvasProgressively(canvas, 28);
        this._setNormalizedCanvas(normalized, size);
    }
    /** Load original dataset pixels through Canvas without a display resize round trip. */
    setSource28(source, size) {
        if (!source || source.length !== 784 || Array.from(source).some(v => !Number.isInteger(v) || v < 0 || v > 255)) {
            throw new Error('M source image must contain 784 bytes.');
        }
        if (!Number.isInteger(size) || size < 2 || size > 28) { throw new Error('M canvas size must be an integer from 2 to 28.'); }
        let normalized = document.createElement('canvas');
        normalized.width = normalized.height = 28;
        let ctx = normalized.getContext('2d');
        let data = ctx.createImageData(28, 28);
        for (let i = 0; i < source.length; i++) {
            data.data[i*4] = data.data[i*4+1] = data.data[i*4+2] = source[i];
            data.data[i*4+3] = 255;
        }
        ctx.putImageData(data, 0, 0);
        this._setNormalizedCanvas(normalized, size);
    }
    _setNormalizedCanvas(normalized, size) {
        let ctx = normalized.getContext('2d');
        let rgba = ctx.getImageData(0, 0, 28, 28).data;
        let source = Array.from({length: 784}, (_, i) => Math.round((rgba[i*4]+rgba[i*4+1]+rgba[i*4+2])/3));
        // Exact area means match training at 4×4; retain floats instead of quantizing M to display bytes.
        this.setPixels(size, areaAverage(source, 28, size), source);
    }
}

function areaAverage(source, sourceSize, targetSize) {
    let result = new Float64Array(targetSize*targetSize);
    let scale = sourceSize/targetSize;
    for (let row = 0; row < targetSize; row++) {
        for (let col = 0; col < targetSize; col++) {
            let sum = 0;
            for (let y = Math.floor(row*scale); y < Math.min(sourceSize, Math.ceil((row+1)*scale)); y++) {
                for (let x = Math.floor(col*scale); x < Math.min(sourceSize, Math.ceil((col+1)*scale)); x++) {
                    let wy = Math.max(0, Math.min(y+1, (row+1)*scale)-Math.max(y,row*scale));
                    let wx = Math.max(0, Math.min(x+1, (col+1)*scale)-Math.max(x,col*scale));
                    sum += source[y*sourceSize+x]*wx*wy;
                }
            }
            result[row*targetSize+col] = Math.max(0, Math.min(1, sum/(255*scale*scale)));
        }
    }
    return result;
}

/** Canvas-only antialiasing: avoid losing thin strokes to one large bilinear shrink. */
function resizeCanvasProgressively(source, targetSize) {
    let current = source;
    do {
        let next = document.createElement('canvas');
        next.width = Math.max(targetSize, Math.ceil(current.width/2));
        next.height = Math.max(targetSize, Math.ceil(current.height/2));
        let ctx = next.getContext('2d');
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, next.width, next.height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(current, 0, 0, next.width, next.height);
        current = next;
    } while (current.width !== targetSize || current.height !== targetSize);
    return current;
}

/** Resolve bounded m(expression, expression) calls without eval or new Function. */
function replaceImageCalls(text, evaluateIndex, depth=0) {
    if (depth > 16 || text.length > 10000) { throw new Error('M expression is too complex.'); }
    let pattern = /\bm\s*\(/ig;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        let start = pattern.lastIndex;
        let level = 1;
        let comma = -1;
        let end = start;
        for (; end < text.length && level > 0; end++) {
            if (text[end] === '(') { level++; }
            if (text[end] === ')') { level--; }
            if (text[end] === ',' && level === 1) {
                if (comma !== -1) { throw new Error('m requires exactly two arguments.'); }
                comma = end;
            }
        }
        if (level !== 0 || comma === -1) { throw new Error('Use m(row,column).'); }
        let rowText = replaceImageCalls(text.slice(start, comma), evaluateIndex, depth+1);
        let colText = replaceImageCalls(text.slice(comma+1, end-1), evaluateIndex, depth+1);
        let value = imageInput.getPixel(evaluateIndex(rowText), evaluateIndex(colText));
        text = text.slice(0,match.index) + '(' + value + ')' + text.slice(end);
        pattern.lastIndex = 0;
    }
    return text;
}

const imageInput = new ImageInput();
export {imageInput, ImageInput, replaceImageCalls};
