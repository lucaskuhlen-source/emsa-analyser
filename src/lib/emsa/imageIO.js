import { UTIF } from './utif';

export function imageToSignal(img) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, W, H).data;
  const sig = new Float32Array(W * H);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const L = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    sig[p] = (255 - L) / 255;
  }
  return { sig, W, H };
}

// Promisified image loader from a data: URL.
export function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Image failed to load"));
    im.src = src;
  });
}

export async function decodeFile(file) {
  const name = (file.name || "").toLowerCase();
  const isTiff = name.endsWith(".tif") || name.endsWith(".tiff");

  if (isTiff) {
    // 16-bit TIFF via vendored UTIF. Display: toRGBA8 -> canvas -> PNG data URL.
    // Signal: full depth for 16-bit grayscale (the reason to use TIFF); for <=8-bit / RGB
    // we reproduce the PNG path exactly off toRGBA8 (no extra depth to preserve).
    const buf = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = (e) => res(e.target.result);
      r.onerror = () => rej(new Error("Could not read file"));
      r.readAsArrayBuffer(file);
    });
    let ifds;
    try { ifds = UTIF.decode(buf); } catch (e) { throw new Error("Could not decode TIFF: " + e.message); }
    if (!ifds || !ifds.length) throw new Error("TIFF contains no images");
    const ifd = ifds[0];
    UTIF.decodeImage(buf, ifd, ifds);
    const W = ifd.width, H = ifd.height;
    if (!W || !H) throw new Error("TIFF has no pixel dimensions");

    // Display (8-bit RGBA; UTIF handles photometric / palette / bit depth).
    const rgba = UTIF.toRGBA8(ifd);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    const idata = ctx.createImageData(W, H);
    idata.data.set(rgba);
    ctx.putImageData(idata, 0, 0);
    const displayUrl = c.toDataURL("image/png");

    // Signal at full depth.
    const bps = ifd.t258 ? ifd.t258[0] : 8;
    const spp = ifd.t277 ? ifd.t277[0] : (ifd.t258 ? ifd.t258.length : 1);
    const intp = ifd.t262 ? ifd.t262[0] : 1;   // 0 = WhiteIsZero, 1 = BlackIsZero (gel imagers)
    const sig = new Float32Array(W * H);
    if (spp === 1 && bps === 16) {
      // Raw 16-bit grayscale. UTIF.toRGBA8 reads the MSB at byte 2*i+1, so the full
      // sample is (data[2i+1]<<8)|data[2i] — mirror that exactly so signal == display.
      const d = ifd.data, max = 65535;
      for (let i = 0; i < W * H; i++) {
        const v = (((d[2 * i + 1] << 8) | d[2 * i]) >>> 0);   // 0..65535
        const bright = intp === 0 ? (max - v) : v;            // brightness (BlackIsZero default)
        sig[i] = (max - bright) / max;                        // dark -> positive, matches imageToSignal
      }
    } else {
      // <=8-bit / RGB / palette: identical to the PNG luminance-inversion convention.
      for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
        const L = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
        sig[p] = (255 - L) / 255;
      }
    }
    return { displayUrl, baseSig: { sig, W, H } };
  }

  // JPEG / PNG path — data: URL + 8-bit canvas signal.
  const displayUrl = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result);
    r.onerror = () => rej(new Error("Could not read file"));
    r.readAsDataURL(file);
  });
  const im = await loadImage(displayUrl);
  let baseSig;
  try { baseSig = imageToSignal(im); }
  catch (e) { baseSig = { sig: null, W: im.naturalWidth, H: im.naturalHeight }; }
  return { displayUrl, baseSig };
}

// Bilinear sample of the float signal at sub-pixel (x,y). Outside the image returns 0
