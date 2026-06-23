import React from "react";
import { createRoot } from "react-dom/client";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import {
  Upload,
  Wand2,
  RotateCcw,
  Minus,
  Beaker,
  ArrowRight,
  Activity,
  Crop,
  Scissors,
  Maximize2,
  Pipette,
  Download,
  Ban,
  RotateCw,
  FileDown,
  Layers,
} from "lucide-react";

/* ----------------------------------------------------------------------------
   TIFF SUPPORT TEMPORARILY REMOVED (vendored UTIF.js block cut while we rework
   rotation). To re-enable: paste the UTIF block back here and restore the TIFF
   branch in decodeFile(). The block is saved as utif_vendored.js.
   ---------------------------------------------------------------------------- */


/* ====================================================================
   Image processing primitives
   ==================================================================== */

function imageToSignal(img) {
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
function loadImage(src) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error("Image failed to load"));
    im.src = src;
  });
}

// Decode an uploaded file into a display URL (8-bit, for <img>) plus a high-precision
// signal ({sig,W,H}). JPEG/PNG go through the canvas (8-bit). TIFF is decoded by the
// vendored UTIF: display via toRGBA8→PNG, but the SIGNAL is built from the RAW samples
// at full bit depth (16-bit linear preserved), which is the whole reason to use TIFF.
/* ============================================================================
   VENDORED LIBRARY — UTIF.js (MIT, github.com/photopea/UTIF.js) — DO NOT EDIT.
   Inlined because the artifact import allow-list has no TIFF decoder and
   browsers can't render TIFF in <img>. Deflate(zip) TIFFs unsupported.
   ============================================================================ */




const UTIF = (function(){
var UTIF = {};


var pako = null; // Deflate-compressed TIFFs unsupported (gel imagers use uncompressed/LZW)

function log() { if (typeof process=="undefined" || process.env.NODE_ENV=="development") console.log.apply(console, arguments);  }

(function(UTIF, pako){
	
// Following lines add a JPEG decoder  to UTIF.JpegDecoder
(function(){var V="function"===typeof Symbol&&"symbol"===typeof Symbol.iterator?function(g){return typeof g}:function(g){return g&&"function"===typeof Symbol&&g.constructor===Symbol&&g!==Symbol.prototype?"symbol":typeof g},D=function(){function g(g){this.message="JPEG error: "+g}g.prototype=Error();g.prototype.name="JpegError";return g.constructor=g}(),P=function(){function g(g,D){this.message=g;this.g=D}g.prototype=Error();g.prototype.name="DNLMarkerError";return g.constructor=g}();(function(){function g(){this.M=
null;this.B=-1}function W(a,d){for(var f=0,e=[],b,B,k=16;0<k&&!a[k-1];)k--;e.push({children:[],index:0});var l=e[0],r;for(b=0;b<k;b++){for(B=0;B<a[b];B++){l=e.pop();for(l.children[l.index]=d[f];0<l.index;)l=e.pop();l.index++;for(e.push(l);e.length<=b;)e.push(r={children:[],index:0}),l.children[l.index]=r.children,l=r;f++}b+1<k&&(e.push(r={children:[],index:0}),l.children[l.index]=r.children,l=r)}return e[0].children}function X(a,d,f,e,b,B,k,l,r){function n(){if(0<x)return x--,z>>x&1;z=a[d++];if(255===
z){var c=a[d++];if(c){if(220===c&&g){d+=2;var b=a[d++]<<8|a[d++];if(0<b&&b!==f.g)throw new P("Found DNL marker (0xFFDC) while parsing scan data",b);}throw new D("unexpected marker "+(z<<8|c).toString(16));}}x=7;return z>>>7}function q(a){for(;;){a=a[n()];if("number"===typeof a)return a;if("object"!==("undefined"===typeof a?"undefined":V(a)))throw new D("invalid huffman sequence");}}function h(a){for(var c=0;0<a;)c=c<<1|n(),a--;return c}function c(a){if(1===a)return 1===n()?1:-1;var c=h(a);return c>=
1<<a-1?c:c+(-1<<a)+1}function C(a,b){var d=q(a.D);d=0===d?0:c(d);a.a[b]=a.m+=d;for(d=1;64>d;){var h=q(a.o),k=h&15;h>>=4;if(0===k){if(15>h)break;d+=16}else d+=h,a.a[b+J[d]]=c(k),d++}}function w(a,d){var b=q(a.D);b=0===b?0:c(b)<<r;a.a[d]=a.m+=b}function p(a,c){a.a[c]|=n()<<r}function m(a,b){if(0<A)A--;else for(var d=B;d<=k;){var e=q(a.o),f=e&15;e>>=4;if(0===f){if(15>e){A=h(e)+(1<<e)-1;break}d+=16}else d+=e,a.a[b+J[d]]=c(f)*(1<<r),d++}}function t(a,d){for(var b=B,e=0,f;b<=k;){f=d+J[b];var l=0>a.a[f]?
-1:1;switch(E){case 0:e=q(a.o);f=e&15;e>>=4;if(0===f)15>e?(A=h(e)+(1<<e),E=4):(e=16,E=1);else{if(1!==f)throw new D("invalid ACn encoding");Q=c(f);E=e?2:3}continue;case 1:case 2:a.a[f]?a.a[f]+=l*(n()<<r):(e--,0===e&&(E=2===E?3:0));break;case 3:a.a[f]?a.a[f]+=l*(n()<<r):(a.a[f]=Q<<r,E=0);break;case 4:a.a[f]&&(a.a[f]+=l*(n()<<r))}b++}4===E&&(A--,0===A&&(E=0))}var g=9<arguments.length&&void 0!==arguments[9]?arguments[9]:!1,u=f.P,v=d,z=0,x=0,A=0,E=0,Q,K=e.length,F,L,M,I;var R=f.S?0===B?0===l?w:p:0===l?
m:t:C;var G=0;var O=1===K?e[0].c*e[0].l:u*f.O;for(var S,T;G<O;){var U=b?Math.min(O-G,b):O;for(F=0;F<K;F++)e[F].m=0;A=0;if(1===K){var y=e[0];for(I=0;I<U;I++)R(y,64*((y.c+1)*(G/y.c|0)+G%y.c)),G++}else for(I=0;I<U;I++){for(F=0;F<K;F++)for(y=e[F],S=y.h,T=y.j,L=0;L<T;L++)for(M=0;M<S;M++)R(y,64*((y.c+1)*((G/u|0)*y.j+L)+(G%u*y.h+M)));G++}x=0;(y=N(a,d))&&y.f&&((0,_util.warn)("decodeScan - unexpected MCU data, current marker is: "+y.f),d=y.offset);y=y&&y.F;if(!y||65280>=y)throw new D("marker was not found");
if(65488<=y&&65495>=y)d+=2;else break}(y=N(a,d))&&y.f&&((0,_util.warn)("decodeScan - unexpected Scan data, current marker is: "+y.f),d=y.offset);return d-v}function Y(a,d){for(var f=d.c,e=d.l,b=new Int16Array(64),B=0;B<e;B++)for(var k=0;k<f;k++){var l=64*((d.c+1)*B+k),r=b,n=d.G,q=d.a;if(!n)throw new D("missing required Quantization Table.");for(var h=0;64>h;h+=8){var c=q[l+h];var C=q[l+h+1];var w=q[l+h+2];var p=q[l+h+3];var m=q[l+h+4];var t=q[l+h+5];var g=q[l+h+6];var u=q[l+h+7];c*=n[h];if(0===(C|
w|p|m|t|g|u))c=5793*c+512>>10,r[h]=c,r[h+1]=c,r[h+2]=c,r[h+3]=c,r[h+4]=c,r[h+5]=c,r[h+6]=c,r[h+7]=c;else{C*=n[h+1];w*=n[h+2];p*=n[h+3];m*=n[h+4];t*=n[h+5];g*=n[h+6];u*=n[h+7];var v=5793*c+128>>8;var z=5793*m+128>>8;var x=w;var A=g;m=2896*(C-u)+128>>8;u=2896*(C+u)+128>>8;p<<=4;t<<=4;v=v+z+1>>1;z=v-z;c=3784*x+1567*A+128>>8;x=1567*x-3784*A+128>>8;A=c;m=m+t+1>>1;t=m-t;u=u+p+1>>1;p=u-p;v=v+A+1>>1;A=v-A;z=z+x+1>>1;x=z-x;c=2276*m+3406*u+2048>>12;m=3406*m-2276*u+2048>>12;u=c;c=799*p+4017*t+2048>>12;p=4017*
p-799*t+2048>>12;t=c;r[h]=v+u;r[h+7]=v-u;r[h+1]=z+t;r[h+6]=z-t;r[h+2]=x+p;r[h+5]=x-p;r[h+3]=A+m;r[h+4]=A-m}}for(n=0;8>n;++n)c=r[n],C=r[n+8],w=r[n+16],p=r[n+24],m=r[n+32],t=r[n+40],g=r[n+48],u=r[n+56],0===(C|w|p|m|t|g|u)?(c=5793*c+8192>>14,c=-2040>c?0:2024<=c?255:c+2056>>4,q[l+n]=c,q[l+n+8]=c,q[l+n+16]=c,q[l+n+24]=c,q[l+n+32]=c,q[l+n+40]=c,q[l+n+48]=c,q[l+n+56]=c):(v=5793*c+2048>>12,z=5793*m+2048>>12,x=w,A=g,m=2896*(C-u)+2048>>12,u=2896*(C+u)+2048>>12,v=(v+z+1>>1)+4112,z=v-z,c=3784*x+1567*A+2048>>
12,x=1567*x-3784*A+2048>>12,A=c,m=m+t+1>>1,t=m-t,u=u+p+1>>1,p=u-p,v=v+A+1>>1,A=v-A,z=z+x+1>>1,x=z-x,c=2276*m+3406*u+2048>>12,m=3406*m-2276*u+2048>>12,u=c,c=799*p+4017*t+2048>>12,p=4017*p-799*t+2048>>12,t=c,c=v+u,u=v-u,C=z+t,g=z-t,w=x+p,t=x-p,p=A+m,m=A-m,c=16>c?0:4080<=c?255:c>>4,C=16>C?0:4080<=C?255:C>>4,w=16>w?0:4080<=w?255:w>>4,p=16>p?0:4080<=p?255:p>>4,m=16>m?0:4080<=m?255:m>>4,t=16>t?0:4080<=t?255:t>>4,g=16>g?0:4080<=g?255:g>>4,u=16>u?0:4080<=u?255:u>>4,q[l+n]=c,q[l+n+8]=C,q[l+n+16]=w,q[l+n+24]=
p,q[l+n+32]=m,q[l+n+40]=t,q[l+n+48]=g,q[l+n+56]=u)}return d.a}function N(a,d){var f=2<arguments.length&&void 0!==arguments[2]?arguments[2]:d,e=a.length-1;f=f<d?f:d;if(d>=e)return null;var b=a[d]<<8|a[d+1];if(65472<=b&&65534>=b)return{f:null,F:b,offset:d};for(var B=a[f]<<8|a[f+1];!(65472<=B&&65534>=B);){if(++f>=e)return null;B=a[f]<<8|a[f+1]}return{f:b.toString(16),F:B,offset:f}}var J=new Uint8Array([0,1,8,16,9,2,3,10,17,24,32,25,18,11,4,5,12,19,26,33,40,48,41,34,27,20,13,6,7,14,21,28,35,42,49,56,
57,50,43,36,29,22,15,23,30,37,44,51,58,59,52,45,38,31,39,46,53,60,61,54,47,55,62,63]);g.prototype={parse:function(a){function d(){var d=a[k]<<8|a[k+1];k+=2;return d}function f(){var b=d();b=k+b-2;var c=N(a,b,k);c&&c.f&&((0,_util.warn)("readDataBlock - incorrect length, current marker is: "+c.f),b=c.offset);b=a.subarray(k,b);k+=b.length;return b}function e(a){for(var b=Math.ceil(a.v/8/a.s),c=Math.ceil(a.g/8/a.u),d=0;d<a.b.length;d++){v=a.b[d];var e=Math.ceil(Math.ceil(a.v/8)*v.h/a.s),f=Math.ceil(Math.ceil(a.g/
8)*v.j/a.u);v.a=new Int16Array(64*c*v.j*(b*v.h+1));v.c=e;v.l=f}a.P=b;a.O=c}var b=(1<arguments.length&&void 0!==arguments[1]?arguments[1]:{}).N,B=void 0===b?null:b,k=0,l=null,r=0;b=[];var n=[],q=[],h=d();if(65496!==h)throw new D("SOI not found");for(h=d();65497!==h;){switch(h){case 65504:case 65505:case 65506:case 65507:case 65508:case 65509:case 65510:case 65511:case 65512:case 65513:case 65514:case 65515:case 65516:case 65517:case 65518:case 65519:case 65534:var c=f();65518===h&&65===c[0]&&100===
c[1]&&111===c[2]&&98===c[3]&&101===c[4]&&(l={version:c[5]<<8|c[6],Y:c[7]<<8|c[8],Z:c[9]<<8|c[10],W:c[11]});break;case 65499:h=d()+k-2;for(var g;k<h;){var w=a[k++],p=new Uint16Array(64);if(0===w>>4)for(c=0;64>c;c++)g=J[c],p[g]=a[k++];else if(1===w>>4)for(c=0;64>c;c++)g=J[c],p[g]=d();else throw new D("DQT - invalid table spec");b[w&15]=p}break;case 65472:case 65473:case 65474:if(m)throw new D("Only single frame JPEGs supported");d();var m={};m.X=65473===h;m.S=65474===h;m.precision=a[k++];h=d();m.g=
B||h;m.v=d();m.b=[];m.C={};c=a[k++];for(h=p=w=0;h<c;h++){g=a[k];var t=a[k+1]>>4;var H=a[k+1]&15;w<t&&(w=t);p<H&&(p=H);t=m.b.push({h:t,j:H,T:a[k+2],G:null});m.C[g]=t-1;k+=3}m.s=w;m.u=p;e(m);break;case 65476:g=d();for(h=2;h<g;){w=a[k++];p=new Uint8Array(16);for(c=t=0;16>c;c++,k++)t+=p[c]=a[k];H=new Uint8Array(t);for(c=0;c<t;c++,k++)H[c]=a[k];h+=17+t;(0===w>>4?q:n)[w&15]=W(p,H)}break;case 65501:d();var u=d();break;case 65498:c=1===++r&&!B;d();w=a[k++];g=[];for(h=0;h<w;h++){p=m.C[a[k++]];var v=m.b[p];
p=a[k++];v.D=q[p>>4];v.o=n[p&15];g.push(v)}h=a[k++];w=a[k++];p=a[k++];try{var z=X(a,k,m,g,u,h,w,p>>4,p&15,c);k+=z}catch(x){if(x instanceof P)return(0,_util.warn)('Attempting to re-parse JPEG image using "scanLines" parameter found in DNL marker (0xFFDC) segment.'),this.parse(a,{N:x.g});throw x;}break;case 65500:k+=4;break;case 65535:255!==a[k]&&k--;break;default:if(255===a[k-3]&&192<=a[k-2]&&254>=a[k-2])k-=3;else if((c=N(a,k-2))&&c.f)(0,_util.warn)("JpegImage.parse - unexpected data, current marker is: "+
c.f),k=c.offset;else throw new D("unknown marker "+h.toString(16));}h=d()}this.width=m.v;this.height=m.g;this.A=l;this.b=[];for(h=0;h<m.b.length;h++){v=m.b[h];if(u=b[v.T])v.G=u;this.b.push({R:Y(m,v),U:v.h/m.s,V:v.j/m.u,c:v.c,l:v.l})}this.i=this.b.length},L:function(a,d){var f=this.width/a,e=this.height/d,b,g,k=this.b.length,l=a*d*k,r=new Uint8ClampedArray(l),n=new Uint32Array(a);for(g=0;g<k;g++){var q=this.b[g];var h=q.U*f;var c=q.V*e;var C=g;var w=q.R;var p=q.c+1<<3;for(b=0;b<a;b++)q=0|b*h,n[b]=
(q&4294967288)<<3|q&7;for(h=0;h<d;h++)for(q=0|h*c,q=p*(q&4294967288)|(q&7)<<3,b=0;b<a;b++)r[C]=w[q+n[b]],C+=k}if(e=this.M)for(g=0;g<l;)for(f=q=0;q<k;q++,g++,f+=2)r[g]=(r[g]*e[f]>>8)+e[f+1];return r},w:function(){return this.A?!!this.A.W:3===this.i?0===this.B?!1:!0:1===this.B?!0:!1},I:function(a){for(var d,f,e,b=0,g=a.length;b<g;b+=3)d=a[b],f=a[b+1],e=a[b+2],a[b]=d-179.456+1.402*e,a[b+1]=d+135.459-.344*f-.714*e,a[b+2]=d-226.816+1.772*f;return a},K:function(a){for(var d,f,e,b,g=0,k=0,l=a.length;k<l;k+=
4)d=a[k],f=a[k+1],e=a[k+2],b=a[k+3],a[g++]=-122.67195406894+f*(-6.60635669420364E-5*f+4.37130475926232E-4*e-5.4080610064599E-5*d+4.8449797120281E-4*b-.154362151871126)+e*(-9.57964378445773E-4*e+8.17076911346625E-4*d-.00477271405408747*b+1.53380253221734)+d*(9.61250184130688E-4*d-.00266257332283933*b+.48357088451265)+b*(-3.36197177618394E-4*b+.484791561490776),a[g++]=107.268039397724+f*(2.19927104525741E-5*f-6.40992018297945E-4*e+6.59397001245577E-4*d+4.26105652938837E-4*b-.176491792462875)+e*(-7.78269941513683E-4*
e+.00130872261408275*d+7.70482631801132E-4*b-.151051492775562)+d*(.00126935368114843*d-.00265090189010898*b+.25802910206845)+b*(-3.18913117588328E-4*b-.213742400323665),a[g++]=-20.810012546947+f*(-5.70115196973677E-4*f-2.63409051004589E-5*e+.0020741088115012*d-.00288260236853442*b+.814272968359295)+e*(-1.53496057440975E-5*e-1.32689043961446E-4*d+5.60833691242812E-4*b-.195152027534049)+d*(.00174418132927582*d-.00255243321439347*b+.116935020465145)+b*(-3.43531996510555E-4*b+.24165260232407);return a.subarray(0,
g)},J:function(a){for(var d,f,e,b=0,g=a.length;b<g;b+=4)d=a[b],f=a[b+1],e=a[b+2],a[b]=434.456-d-1.402*e,a[b+1]=119.541-d+.344*f+.714*e,a[b+2]=481.816-d-1.772*f;return a},H:function(a){for(var d,f,e,b,g=0,k=1/255,l=0,r=a.length;l<r;l+=4)d=a[l]*k,f=a[l+1]*k,e=a[l+2]*k,b=a[l+3]*k,a[g++]=255+d*(-4.387332384609988*d+54.48615194189176*f+18.82290502165302*e+212.25662451639585*b-285.2331026137004)+f*(1.7149763477362134*f-5.6096736904047315*e-17.873870861415444*b-5.497006427196366)+e*(-2.5217340131683033*
e-21.248923337353073*b+17.5119270841813)-b*(21.86122147463605*b+189.48180835922747),a[g++]=255+d*(8.841041422036149*d+60.118027045597366*f+6.871425592049007*e+31.159100130055922*b-79.2970844816548)+f*(-15.310361306967817*f+17.575251261109482*e+131.35250912493976*b-190.9453302588951)+e*(4.444339102852739*e+9.8632861493405*b-24.86741582555878)-b*(20.737325471181034*b+187.80453709719578),a[g++]=255+d*(.8842522430003296*d+8.078677503112928*f+30.89978309703729*e-.23883238689178934*b-14.183576799673286)+
f*(10.49593273432072*f+63.02378494754052*e+50.606957656360734*b-112.23884253719248)+e*(.03296041114873217*e+115.60384449646641*b-193.58209356861505)-b*(22.33816807309886*b+180.12613974708367);return a.subarray(0,g)},getData:function(a,d,f){if(4<this.i)throw new D("Unsupported color mode");a=this.L(a,d);if(1===this.i&&f){f=a.length;d=new Uint8ClampedArray(3*f);for(var e=0,b=0;b<f;b++){var g=a[b];d[e++]=g;d[e++]=g;d[e++]=g}return d}if(3===this.i&&this.w())return this.I(a);if(4===this.i){if(this.w())return f?
this.K(a):this.J(a);if(f)return this.H(a)}return a}}; UTIF.JpegDecoder=g})()})();

//UTIF.JpegDecoder = PDFJS.JpegImage;


UTIF.encodeImage = function(rgba, w, h, metadata)
{
	var idf = { "t256":[w], "t257":[h], "t258":[8,8,8,8], "t259":[1], "t262":[2], "t273":[1000], // strips offset
				"t277":[4], "t278":[h], /* rows per strip */          "t279":[w*h*4], // strip byte counts
				"t282":[1], "t283":[1], "t284":[1], "t286":[0], "t287":[0], "t296":[1], "t305": ["Photopea (UTIF.js)"], "t338":[1]
		};
	if (metadata) for (var i in metadata) idf[i] = metadata[i];
	
	var prfx = new Uint8Array(UTIF.encode([idf]));
	var img = new Uint8Array(rgba);
	var data = new Uint8Array(1000+w*h*4);
	for(var i=0; i<prfx.length; i++) data[i] = prfx[i];
	for(var i=0; i<img .length; i++) data[1000+i] = img[i];
	return data.buffer;
}

UTIF.encode = function(ifds)
{
	var data = new Uint8Array(20000), offset = 4, bin = UTIF._binBE;
	data[0]=77;  data[1]=77;  data[3]=42;

	var ifdo = 8;
	bin.writeUint(data, offset, ifdo);  offset+=4;
	for(var i=0; i<ifds.length; i++)
	{
		var noffs = UTIF._writeIFD(bin, data, ifdo, ifds[i]);
		ifdo = noffs[1];
		if(i<ifds.length-1) bin.writeUint(data, noffs[0], ifdo);
	}
	return data.slice(0, ifdo).buffer;
}
//UTIF.encode._writeIFD

UTIF.decode = function(buff)
{
	UTIF.decode._decodeG3.allow2D = null;
	var data = new Uint8Array(buff), offset = 0;

	var id = UTIF._binBE.readASCII(data, offset, 2);  offset+=2;
	var bin = id=="II" ? UTIF._binLE : UTIF._binBE;
	var num = bin.readUshort(data, offset);  offset+=2;

	var ifdo = bin.readUint(data, offset);  offset+=4;
	var ifds = [];
	while(true) {
		var noff = UTIF._readIFD(bin, data, ifdo, ifds, 0, false);
		ifdo = bin.readUint(data, noff);
		if(ifdo==0) break;
	}
	return ifds;
}

UTIF.decodeImage = function(buff, img, ifds)
{
	var data = new Uint8Array(buff);
	var id = UTIF._binBE.readASCII(data, 0, 2);

	if(img["t256"]==null) return;	// No width => probably not an image
	img.isLE = id=="II";
	img.width  = img["t256"][0];  //delete img["t256"];
	img.height = img["t257"][0];  //delete img["t257"];

	var cmpr   = img["t259"] ? img["t259"][0] : 1;  //delete img["t259"];
	var fo = img["t266"] ? img["t266"][0] : 1;  //delete img["t266"];
	if(img["t284"] && img["t284"][0]==2) log("PlanarConfiguration 2 should not be used!");

	var bipp;  // bits per pixel
	if(img["t258"]) bipp = Math.min(32,img["t258"][0])*img["t258"].length;
	else            bipp = (img["t277"]?img["t277"][0]:1);  
	// Some .NEF files have t258==14, even though they use 16 bits per pixel
	if(cmpr==1 && img["t279"]!=null && img["t278"] && img["t262"][0]==32803)  {
		bipp = Math.round((img["t279"][0]*8)/(img.width*img["t278"][0]));
	}
	var bipl = Math.ceil(img.width*bipp/8)*8;
	var soff = img["t273"];  if(soff==null) soff = img["t324"];
	var bcnt = img["t279"];  if(cmpr==1 && soff.length==1) bcnt = [img.height*(bipl>>>3)];  if(bcnt==null) bcnt = img["t325"];
	var bytes = new Uint8Array(img.height*(bipl>>>3)), bilen = 0;

	if(img["t322"]!=null) // tiled
	{
		var tw = img["t322"][0], th = img["t323"][0];
		var tx = Math.floor((img.width  + tw - 1) / tw);
		var ty = Math.floor((img.height + th - 1) / th);
		var tbuff = new Uint8Array(Math.ceil(tw*th*bipp/8)|0);
		for(var y=0; y<ty; y++)
			for(var x=0; x<tx; x++)
			{
				var i = y*tx+x;  for(var j=0; j<tbuff.length; j++) tbuff[j]=0;
				UTIF.decode._decompress(img,ifds, data, soff[i], bcnt[i], cmpr, tbuff, 0, fo);
				// Might be required for 7 too. Need to check
				if (cmpr==6) bytes = tbuff;
				else UTIF._copyTile(tbuff, Math.ceil(tw*bipp/8)|0, th, bytes, Math.ceil(img.width*bipp/8)|0, img.height, Math.ceil(x*tw*bipp/8)|0, y*th);
			}
		bilen = bytes.length*8;
	}
	else	// stripped
	{
		var rps = img["t278"] ? img["t278"][0] : img.height;   rps = Math.min(rps, img.height);
		for(var i=0; i<soff.length; i++)
		{
			UTIF.decode._decompress(img,ifds, data, soff[i], bcnt[i], cmpr, bytes, Math.ceil(bilen/8)|0, fo);
			bilen += bipl * rps;
		}
		bilen = Math.min(bilen, bytes.length*8);
	}
	img.data = new Uint8Array(bytes.buffer, 0, Math.ceil(bilen/8)|0);
}

UTIF.decode._decompress = function(img,ifds, data, off, len, cmpr, tgt, toff, fo)  // fill order
{
	//console.log("compression", cmpr);
	//var time = Date.now();
	if(false) {}
	else if(cmpr==1 || (len==tgt.length && cmpr!=32767)) for(var j=0; j<len; j++) tgt[toff+j] = data[off+j];
	else if(cmpr==3) UTIF.decode._decodeG3 (data, off, len, tgt, toff, img.width, fo);
	else if(cmpr==4) UTIF.decode._decodeG4 (data, off, len, tgt, toff, img.width, fo);
	else if(cmpr==5) UTIF.decode._decodeLZW(data, off, tgt, toff);
	else if(cmpr==6) UTIF.decode._decodeOldJPEG(img, data, off, len, tgt, toff);
	else if(cmpr==7) UTIF.decode._decodeNewJPEG(img, data, off, len, tgt, toff);
	else if(cmpr==8) {  var src = new Uint8Array(data.buffer,off,len);  var bin = pako["inflate"](src);  for(var i=0; i<bin.length; i++) tgt[toff+i]=bin[i];  }
	else if(cmpr==32767) UTIF.decode._decodeARW(img, data, off, len, tgt, toff);
	else if(cmpr==32773) UTIF.decode._decodePackBits(data, off, len, tgt, toff);
	else if(cmpr==32809) UTIF.decode._decodeThunder (data, off, len, tgt, toff);
	else if(cmpr==34713) //for(var j=0; j<len; j++) tgt[toff+j] = data[off+j];
		UTIF.decode._decodeNikon   (img,ifds, data, off, len, tgt, toff);
	else log("Unknown compression", cmpr);
	
	//console.log(Date.now()-time);
	
	var bps = (img["t258"]?Math.min(32,img["t258"][0]):1);
	var noc = (img["t277"]?img["t277"][0]:1), bpp=(bps*noc)>>>3, h = (img["t278"] ? img["t278"][0] : img.height), bpl = Math.ceil(bps*noc*img.width/8);
	
	// convert to Little Endian  /*
	if(bps==16 && !img.isLE && img["t33422"]==null)  // not DNG
		for(var y=0; y<h; y++) {
			//console.log("fixing endianity");
			var roff = toff+y*bpl;
			for(var x=1; x<bpl; x+=2) {  var t=tgt[roff+x];  tgt[roff+x]=tgt[roff+x-1];  tgt[roff+x-1]=t;  }
		}  //*/

	if(img["t317"] && img["t317"][0]==2)
	{
		for(var y=0; y<h; y++)
		{
			var ntoff = toff+y*bpl;
			if(bps==16) for(var j=bpp; j<bpl; j+=2) {
				var nv = ((tgt[ntoff+j+1]<<8)|tgt[ntoff+j])  +  ((tgt[ntoff+j-bpp+1]<<8)|tgt[ntoff+j-bpp]);
				tgt[ntoff+j] = nv&255;  tgt[ntoff+j+1] = (nv>>>8)&255;  
			}
			else if(noc==3) for(var j=  3; j<bpl; j+=3)
			{
				tgt[ntoff+j  ] = (tgt[ntoff+j  ] + tgt[ntoff+j-3])&255;
				tgt[ntoff+j+1] = (tgt[ntoff+j+1] + tgt[ntoff+j-2])&255;
				tgt[ntoff+j+2] = (tgt[ntoff+j+2] + tgt[ntoff+j-1])&255;
			}
			else for(var j=bpp; j<bpl; j++) tgt[ntoff+j] = (tgt[ntoff+j] + tgt[ntoff+j-bpp])&255;
		}
	}
}

UTIF.decode._ljpeg_diff = function(data, prm, huff) {
	var getbithuff   = UTIF.decode._getbithuff;
	var len, diff;
	len  = getbithuff(data, prm, huff[0], huff);
	diff = getbithuff(data, prm, len, 0);
	if ((diff & (1 << (len-1))) == 0)  diff -= (1 << len) - 1;
	return diff;
}
UTIF.decode._decodeARW = function(img, inp, off, src_length, tgt, toff) {
	var raw_width = img["t256"][0], height=img["t257"][0], tiff_bps=img["t258"][0];
	var bin=(img.isLE ? UTIF._binLE : UTIF._binBE);
	//console.log(raw_width, height, tiff_bps, raw_width*height, src_length);
	var arw2 = (raw_width*height == src_length) || (raw_width*height*1.5 == src_length);
	//arw2 = true;
	//console.log("ARW2: ", arw2, raw_width*height, src_length, tgt.length);
	if(!arw2) {  //"sony_arw_load_raw"; // not arw2
		height+=8;
		var prm = [off,0,0,0];
		var huff = new Uint16Array(32770);
		var tab = [ 0xf11,0xf10,0xe0f,0xd0e,0xc0d,0xb0c,0xa0b,0x90a,0x809,
			0x708,0x607,0x506,0x405,0x304,0x303,0x300,0x202,0x201 ];
		var i, c, n, col, row, sum=0;
		var ljpeg_diff = UTIF.decode._ljpeg_diff;

		huff[0] = 15;
		for (n=i=0; i < 18; i++) {
			var lim = 32768 >>> (tab[i] >>> 8);
			for(var c=0; c<lim; c++) huff[++n] = tab[i];
		}
		for (col = raw_width; col--; )
			for (row=0; row < height+1; row+=2) {
				if (row == height) row = 1;
				sum += ljpeg_diff(inp, prm, huff);
				if (row < height) {
					var clr =  (sum)&4095;
					UTIF.decode._putsF(tgt, (row*raw_width+col)*tiff_bps, clr<<(16-tiff_bps));
				}
			}
		return;
	}
	if(raw_width*height*1.5==src_length) {
		//console.log("weird compression");
		for(var i=0; i<src_length; i+=3) {  var b0=inp[off+i+0], b1=inp[off+i+1], b2=inp[off+i+2];  
			tgt[toff+i]=(b1<<4)|(b0>>>4);  tgt[toff+i+1]=(b0<<4)|(b2>>>4);  tgt[toff+i+2]=(b2<<4)|(b1>>>4);  }
		return;
	}
	
	var pix = new Uint16Array(16);
	var row, col, val, max, min, imax, imin, sh, bit, i,    dp;
	
	var data = new Uint8Array(raw_width+1);
	for (row=0; row < height; row++) {
		//fread (data, 1, raw_width, ifp);
		for(var j=0; j<raw_width; j++) data[j]=inp[off++];
		for (dp=0, col=0; col < raw_width-30; dp+=16) {
			max  = 0x7ff & (val = bin.readUint(data,dp));
			min  = 0x7ff & (val >>> 11);
			imax = 0x0f & (val >>> 22);
			imin = 0x0f & (val >>> 26);
			for (sh=0; sh < 4 && 0x80 << sh <= max-min; sh++);
			for (bit=30, i=0; i < 16; i++)
				if      (i == imax) pix[i] = max;
				else if (i == imin) pix[i] = min;
				else {
					pix[i] = ((bin.readUshort(data, dp+(bit >> 3)) >>> (bit & 7) & 0x7f) << sh) + min;
					if (pix[i] > 0x7ff) pix[i] = 0x7ff;
					bit += 7;
				}
			for (i=0; i < 16; i++, col+=2) {
				//RAW(row,col) = curve[pix[i] << 1] >> 2;
				var clr =  pix[i]<<1;   //clr = 0xffff;
				UTIF.decode._putsF(tgt, (row*raw_width+col)*tiff_bps, clr<<(16-tiff_bps));
			}
			col -= col & 1 ? 1:31;
		}
	}
}

UTIF.decode._decodeNikon = function(img,imgs, data, off, src_length, tgt, toff)
{
	var nikon_tree = [
    [ 0, 0,1,5,1,1,1,1,1,1,2,0,0,0,0,0,0,	/* 12-bit lossy */
      5,4,3,6,2,7,1,0,8,9,11,10,12 ],
    [ 0, 0,1,5,1,1,1,1,1,1,2,0,0,0,0,0,0,	/* 12-bit lossy after split */
      0x39,0x5a,0x38,0x27,0x16,5,4,3,2,1,0,11,12,12 ],
    [ 0, 0,1,4,2,3,1,2,0,0,0,0,0,0,0,0,0,  /* 12-bit lossless */
      5,4,6,3,7,2,8,1,9,0,10,11,12 ],
    [ 0, 0,1,4,3,1,1,1,1,1,2,0,0,0,0,0,0,	/* 14-bit lossy */
      5,6,4,7,8,3,9,2,1,0,10,11,12,13,14 ],
    [ 0, 0,1,5,1,1,1,1,1,1,1,2,0,0,0,0,0,	/* 14-bit lossy after split */
      8,0x5c,0x4b,0x3a,0x29,7,6,5,4,3,2,1,0,13,14 ],
    [ 0, 0,1,4,2,2,3,1,2,0,0,0,0,0,0,0,0,	/* 14-bit lossless */
      7,6,8,5,9,4,10,3,11,12,2,0,1,13,14 ] ];
	  
	var raw_width = img["t256"][0], height=img["t257"][0], tiff_bps=img["t258"][0];
	
	var tree = 0, split = 0;
	var make_decoder = UTIF.decode._make_decoder;
	var getbithuff   = UTIF.decode._getbithuff;
	
	var mn = imgs[0].exifIFD.makerNote, md = mn["t150"]?mn["t150"]:mn["t140"], mdo=0;  //console.log(mn,md);
	//console.log(md[0].toString(16), md[1].toString(16), tiff_bps);
	var ver0 = md[mdo++], ver1 = md[mdo++];
	if (ver0 == 0x49 || ver1 == 0x58)  mdo+=2110;
	if (ver0 == 0x46) tree = 2;
	if (tiff_bps == 14) tree += 3;
	
	var vpred = [[0,0],[0,0]], bin=(img.isLE ? UTIF._binLE : UTIF._binBE);
	for(var i=0; i<2; i++) for(var j=0; j<2; j++) {  vpred[i][j] = bin.readShort(md,mdo);  mdo+=2;   }  // not sure here ... [i][j] or [j][i]
	//console.log(vpred);
	
	
	var max = 1 << tiff_bps & 0x7fff, step=0;
	var csize = bin.readShort(md,mdo);  mdo+=2;
	if (csize > 1) step = Math.floor(max / (csize-1));
	if (ver0 == 0x44 && ver1 == 0x20 && step > 0)  split = bin.readShort(md,562);
	
	
	var i;
	var row, col;
	var len, shl, diff;
	var min_v = 0;
	var hpred = [0,0];
	var huff = make_decoder(nikon_tree[tree]);
	
	//var g_input_offset=0, bitbuf=0, vbits=0, reset=0;
	var prm = [off,0,0,0];
	//console.log(split);  split = 170;
	
	for (min_v=row=0; row < height; row++) {
		if (split && row == split) {
			//free (huff);
			huff = make_decoder (nikon_tree[tree+1]);
			//max_v += (min_v = 16) << 1;
		}
		for (col=0; col < raw_width; col++) {
			i = getbithuff(data,prm,huff[0],huff);
			len = i  & 15;
			shl = i >>> 4;
			diff = (((getbithuff(data,prm,len-shl,0) << 1) + 1) << shl) >>> 1;
			if ((diff & (1 << (len-1))) == 0)
				diff -= (1 << len) - (shl==0?1:0);
			if (col < 2) hpred[col] = vpred[row & 1][col] += diff;
			else         hpred[col & 1] += diff;
			
			var clr = Math.min(Math.max(hpred[col & 1],0),(1<<tiff_bps)-1);
			var bti = (row*raw_width+col)*tiff_bps;  
			UTIF.decode._putsF(tgt, bti, clr<<(16-tiff_bps));
		}
	}
}
// put 16 bits
UTIF.decode._putsF= function(dt, pos, val) {  val = val<<(8-(pos&7));  var o=(pos>>>3);  dt[o]|=val>>>16;  dt[o+1]|=val>>>8;  dt[o+2]|=val;  }


UTIF.decode._getbithuff = function(data,prm,nbits, huff) {
	var zero_after_ff = 0;
	var get_byte = UTIF.decode._get_byte;
	var c;
  
	var off=prm[0], bitbuf=prm[1], vbits=prm[2], reset=prm[3];

	//if (nbits > 25) return 0;
	//if (nbits <  0) return bitbuf = vbits = reset = 0;
	if (nbits == 0 || vbits < 0) return 0; 
	while (!reset && vbits < nbits && (c = data[off++]) != -1 &&
		!(reset = zero_after_ff && c == 0xff && data[off++])) {
		//console.log("byte read into c");
		bitbuf = (bitbuf << 8) + c;
		vbits += 8;
	} 
	c = (bitbuf << (32-vbits)) >>> (32-nbits);
	if (huff) {
		vbits -= huff[c+1] >>> 8;  //console.log(c, huff[c]>>8);
		c =  huff[c+1]&255;
	} else
		vbits -= nbits;
	if (vbits < 0) throw "e";
  
	prm[0]=off;  prm[1]=bitbuf;  prm[2]=vbits;  prm[3]=reset;
  
	return c;
}

UTIF.decode._make_decoder = function(source) {
	var max, len, h, i, j;
	var huff = [];

	for (max=16; max!=0 && !source[max]; max--);
	var si=17;
	
	huff[0] = max;
	for (h=len=1; len <= max; len++)
		for (i=0; i < source[len]; i++, ++si)
			for (j=0; j < 1 << (max-len); j++)
				if (h <= 1 << max)
					huff[h++] = (len << 8) | source[si];
	return huff;
}

UTIF.decode._decodeNewJPEG = function(img, data, off, len, tgt, toff)
{
	var tables = img["t347"], tlen = tables ? tables.length : 0, buff = new Uint8Array(tlen + len);
	
	if (tables) {
		var SOI = 216, EOI = 217, boff = 0;
		for (var i=0; i<(tlen-1); i++)
		{
			// Skip EOI marker from JPEGTables
			if (tables[i]==255 && tables[i+1]==EOI) break;
			buff[boff++] = tables[i];
		}

		// Skip SOI marker from data
		var byte1 = data[off], byte2 = data[off + 1];
		if (byte1!=255 || byte2!=SOI)
		{
			buff[boff++] = byte1;
			buff[boff++] = byte2;
		}
		for (var i=2; i<len; i++) buff[boff++] = data[off+i];
	}
	else for (var i=0; i<len; i++) buff[i] = data[off+i];

	if(img["t262"][0]==32803 || img["t262"][0]==34892) // lossless JPEG and lossy JPEG (used in DNG files)
	{
		var bps = img["t258"][0];//, dcdr = new LosslessJpegDecoder();
		var out = UTIF.LosslessJpegDecode(buff), olen=out.length;  //console.log(olen);
		
		if(false) {}
		else if(bps==16) {
			if(img.isLE) for(var i=0; i<olen; i++ ) {  tgt[toff+(i<<1)] = (out[i]&255);  tgt[toff+(i<<1)+1] = (out[i]>>>8);  }
			else         for(var i=0; i<olen; i++ ) {  tgt[toff+(i<<1)] = (out[i]>>>8);  tgt[toff+(i<<1)+1] = (out[i]&255);  }
		}
		else if(bps==14 || bps==12) {  // 4 * 14 == 56 == 7 * 8
			var rst = 16-bps;
			for(var i=0; i<olen; i++) UTIF.decode._putsF(tgt, i*bps, out[i]<<rst);
		}
		else throw new Error("unsupported bit depth "+bps);
	}
	else
	{
		var parser = new UTIF.JpegDecoder();  parser.parse(buff);
		var decoded = parser.getData(parser.width, parser.height);
		for (var i=0; i<decoded.length; i++) tgt[toff + i] = decoded[i];
	}

	// PhotometricInterpretation is 6 (YCbCr) for JPEG, but after decoding we populate data in
	// RGB format, so updating the tag value
	if(img["t262"][0] == 6)  img["t262"][0] = 2;
}

UTIF.decode._decodeOldJPEGInit = function(img, data, off, len)
{
	var SOI = 216, EOI = 217, DQT = 219, DHT = 196, DRI = 221, SOF0 = 192, SOS = 218;
	var joff = 0, soff = 0, tables, sosMarker, isTiled = false, i, j, k;
	var jpgIchgFmt    = img["t513"], jifoff = jpgIchgFmt ? jpgIchgFmt[0] : 0;
	var jpgIchgFmtLen = img["t514"], jiflen = jpgIchgFmtLen ? jpgIchgFmtLen[0] : 0;
	var soffTag       = img["t324"] || img["t273"] || jpgIchgFmt;
	var ycbcrss       = img["t530"], ssx = 0, ssy = 0;
	var spp           = img["t277"]?img["t277"][0]:1;
	var jpgresint     = img["t515"];

	if(soffTag)
	{
		soff = soffTag[0];
		isTiled = (soffTag.length > 1);
	}

	if(!isTiled)
	{
		if(data[off]==255 && data[off+1]==SOI) return { jpegOffset: off };
		if(jpgIchgFmt!=null)
		{
			if(data[off+jifoff]==255 && data[off+jifoff+1]==SOI) joff = off+jifoff;
			else log("JPEGInterchangeFormat does not point to SOI");

			if(jpgIchgFmtLen==null) log("JPEGInterchangeFormatLength field is missing");
			else if(jifoff >= soff || (jifoff+jiflen) <= soff) log("JPEGInterchangeFormatLength field value is invalid");

			if(joff != null) return { jpegOffset: joff };
		}
	}

	if(ycbcrss!=null) {  ssx = ycbcrss[0];  ssy = ycbcrss[1];  }

	if(jpgIchgFmt!=null)
		if(jpgIchgFmtLen!=null)
			if(jiflen >= 2 && (jifoff+jiflen) <= soff)
			{
				if(data[off+jifoff+jiflen-2]==255 && data[off+jifoff+jiflen-1]==SOI) tables = new Uint8Array(jiflen-2);
				else tables = new Uint8Array(jiflen);

				for(i=0; i<tables.length; i++) tables[i] = data[off+jifoff+i];
				log("Incorrect JPEG interchange format: using JPEGInterchangeFormat offset to derive tables");
			}
			else log("JPEGInterchangeFormat+JPEGInterchangeFormatLength > offset to first strip or tile");

	if(tables == null)
	{
		var ooff = 0, out = [];
		out[ooff++] = 255; out[ooff++] = SOI;

		var qtables = img["t519"];
		if(qtables==null) throw new Error("JPEGQTables tag is missing");
		for(i=0; i<qtables.length; i++)
		{
			out[ooff++] = 255; out[ooff++] = DQT; out[ooff++] = 0; out[ooff++] = 67; out[ooff++] = i;
			for(j=0; j<64; j++) out[ooff++] = data[off+qtables[i]+j];
		}

		for(k=0; k<2; k++)
		{
			var htables = img[(k == 0) ? "t520" : "t521"];
			if(htables==null) throw new Error(((k == 0) ? "JPEGDCTables" : "JPEGACTables") + " tag is missing");
			for(i=0; i<htables.length; i++)
			{
				out[ooff++] = 255; out[ooff++] = DHT;
				//out[ooff++] = 0; out[ooff++] = 67; out[ooff++] = i;
				var nc = 19;
				for(j=0; j<16; j++) nc += data[off+htables[i]+j];

				out[ooff++] = (nc >>> 8); out[ooff++] = nc & 255;
				out[ooff++] = (i | (k << 4));
				for(j=0; j<16; j++) out[ooff++] = data[off+htables[i]+j];
				for(j=0; j<nc; j++) out[ooff++] = data[off+htables[i]+16+j];
			}
		}

		out[ooff++] = 255; out[ooff++] = SOF0;
		out[ooff++] = 0;  out[ooff++] = 8 + 3*spp;  out[ooff++] = 8;
		out[ooff++] = (img.height >>> 8) & 255;  out[ooff++] = img.height & 255;
		out[ooff++] = (img.width  >>> 8) & 255;  out[ooff++] = img.width  & 255;
		out[ooff++] = spp;
		if(spp==1) {  out[ooff++] = 1;  out[ooff++] = 17;  out[ooff++] = 0;  }
		else for(i=0; i<3; i++)
		{
			out[ooff++] = i + 1;
			out[ooff++] = (i != 0) ? 17 : (((ssx & 15) << 4) | (ssy & 15));
			out[ooff++] = i;
		}

		if(jpgresint!=null && jpgresint[0]!=0)
		{
			out[ooff++] = 255;  out[ooff++] = DRI;  out[ooff++] = 0;  out[ooff++] = 4;
			out[ooff++] = (jpgresint[0] >>> 8) & 255;
			out[ooff++] = jpgresint[0] & 255;
		}

		tables = new Uint8Array(out);
	}

	var sofpos = -1;
	i = 0;
	while(i < (tables.length - 1)) {
		if(tables[i]==255 && tables[i+1]==SOF0) {  sofpos = i; break;  }
		i++;
	}

	if(sofpos == -1)
	{
		var tmptab = new Uint8Array(tables.length + 10 + 3*spp);
		tmptab.set(tables);
		var tmpoff = tables.length;
		sofpos = tables.length;
		tables = tmptab;

		tables[tmpoff++] = 255; tables[tmpoff++] = SOF0;
		tables[tmpoff++] = 0;  tables[tmpoff++] = 8 + 3*spp;  tables[tmpoff++] = 8;
		tables[tmpoff++] = (img.height >>> 8) & 255;  tables[tmpoff++] = img.height & 255;
		tables[tmpoff++] = (img.width  >>> 8) & 255;  tables[tmpoff++] = img.width  & 255;
		tables[tmpoff++] = spp;
		if(spp==1) {  tables[tmpoff++] = 1;  tables[tmpoff++] = 17;  tables[tmpoff++] = 0;  }
		else for(i=0; i<3; i++)
		{
			tables[tmpoff++] = i + 1;
			tables[tmpoff++] = (i != 0) ? 17 : (((ssx & 15) << 4) | (ssy & 15));
			tables[tmpoff++] = i;
		}
	}

	if(data[soff]==255 && data[soff+1]==SOS)
	{
		var soslen = (data[soff+2]<<8) | data[soff+3];
		sosMarker = new Uint8Array(soslen+2);
		sosMarker[0] = data[soff];  sosMarker[1] = data[soff+1]; sosMarker[2] = data[soff+2];  sosMarker[3] = data[soff+3];
		for(i=0; i<(soslen-2); i++) sosMarker[i+4] = data[soff+i+4];
	}
	else
	{
		sosMarker = new Uint8Array(2 + 6 + 2*spp);
		var sosoff = 0;
		sosMarker[sosoff++] = 255;  sosMarker[sosoff++] = SOS;
		sosMarker[sosoff++] = 0;  sosMarker[sosoff++] = 6 + 2*spp;  sosMarker[sosoff++] = spp;
		if(spp==1) {  sosMarker[sosoff++] = 1;  sosMarker[sosoff++] = 0;  }
		else for(i=0; i<3; i++)
		{
			sosMarker[sosoff++] = i+1;  sosMarker[sosoff++] = (i << 4) | i;
		}
		sosMarker[sosoff++] = 0;  sosMarker[sosoff++] = 63;  sosMarker[sosoff++] = 0;
	}

	return { jpegOffset: off, tables: tables, sosMarker: sosMarker, sofPosition: sofpos };
}

UTIF.decode._decodeOldJPEG = function(img, data, off, len, tgt, toff)
{
	var i, dlen, tlen, buff, buffoff;
	var jpegData = UTIF.decode._decodeOldJPEGInit(img, data, off, len);

	if(jpegData.jpegOffset!=null)
	{
		dlen = off+len-jpegData.jpegOffset;
		buff = new Uint8Array(dlen);
		for(i=0; i<dlen; i++) buff[i] = data[jpegData.jpegOffset+i];
	}
	else
	{
		tlen = jpegData.tables.length;
		buff = new Uint8Array(tlen + jpegData.sosMarker.length + len + 2);
		buff.set(jpegData.tables);
		buffoff = tlen;

		buff[jpegData.sofPosition+5] = (img.height >>> 8) & 255;  buff[jpegData.sofPosition+6] = img.height & 255;
		buff[jpegData.sofPosition+7] = (img.width  >>> 8) & 255;  buff[jpegData.sofPosition+8] = img.width  & 255;

		if(data[off]!=255 || data[off+1]!=SOS)
		{
			buff.set(jpegData.sosMarker, buffoff);
			buffoff += sosMarker.length;
		}
		for(i=0; i<len; i++) buff[buffoff++] = data[off+i];
		buff[buffoff++] = 255;  buff[buffoff++] = EOI;
	}

	var parser = new UTIF.JpegDecoder();  parser.parse(buff);
	var decoded = parser.getData(parser.width, parser.height);
	for (var i=0; i<decoded.length; i++) tgt[toff + i] = decoded[i];

	// PhotometricInterpretation is 6 (YCbCr) for JPEG, but after decoding we populate data in
	// RGB format, so updating the tag value
	if(img["t262"] && img["t262"][0] == 6)  img["t262"][0] = 2;
}

UTIF.decode._decodePackBits = function(data, off, len, tgt, toff)
{
	var sa = new Int8Array(data.buffer), ta = new Int8Array(tgt.buffer), lim = off+len;
	while(off<lim)
	{
		var n = sa[off];  off++;
		if(n>=0  && n<128)    for(var i=0; i< n+1; i++) {  ta[toff]=sa[off];  toff++;  off++;   }
		if(n>=-127 && n<0) {  for(var i=0; i<-n+1; i++) {  ta[toff]=sa[off];  toff++;           }  off++;  }
	}
}

UTIF.decode._decodeThunder = function(data, off, len, tgt, toff)
{
	var d2 = [ 0, 1, 0, -1 ],  d3 = [ 0, 1, 2, 3, 0, -3, -2, -1 ];
	var lim = off+len, qoff = toff*2, px = 0;
	while(off<lim)
	{
		var b = data[off], msk = (b>>>6), n = (b&63);  off++;
		if(msk==3) { px=(n&15);  tgt[qoff>>>1] |= (px<<(4*(1-qoff&1)));  qoff++;   }
		if(msk==0) for(var i=0; i<n; i++) {  tgt[qoff>>>1] |= (px<<(4*(1-qoff&1)));  qoff++;   }
		if(msk==2) for(var i=0; i<2; i++) {  var d=(n>>>(3*(1-i)))&7;  if(d!=4) { px+=d3[d];  tgt[qoff>>>1] |= (px<<(4*(1-qoff&1)));  qoff++; }  }
		if(msk==1) for(var i=0; i<3; i++) {  var d=(n>>>(2*(2-i)))&3;  if(d!=2) { px+=d2[d];  tgt[qoff>>>1] |= (px<<(4*(1-qoff&1)));  qoff++; }  }
	}
}

UTIF.decode._dmap = { "1":0,"011":1,"000011":2,"0000011":3, "010":-1,"000010":-2,"0000010":-3  };
UTIF.decode._lens = ( function()
{
	var addKeys = function(lens, arr, i0, inc) {  for(var i=0; i<arr.length; i++) lens[arr[i]] = i0 + i*inc;  }

	var termW = "00110101,000111,0111,1000,1011,1100,1110,1111,10011,10100,00111,01000,001000,000011,110100,110101," // 15
	+ "101010,101011,0100111,0001100,0001000,0010111,0000011,0000100,0101000,0101011,0010011,0100100,0011000,00000010,00000011,00011010," // 31
	+ "00011011,00010010,00010011,00010100,00010101,00010110,00010111,00101000,00101001,00101010,00101011,00101100,00101101,00000100,00000101,00001010," // 47
	+ "00001011,01010010,01010011,01010100,01010101,00100100,00100101,01011000,01011001,01011010,01011011,01001010,01001011,00110010,00110011,00110100";

	var termB = "0000110111,010,11,10,011,0011,0010,00011,000101,000100,0000100,0000101,0000111,00000100,00000111,000011000," // 15
	+ "0000010111,0000011000,0000001000,00001100111,00001101000,00001101100,00000110111,00000101000,00000010111,00000011000,000011001010,000011001011,000011001100,000011001101,000001101000,000001101001," // 31
	+ "000001101010,000001101011,000011010010,000011010011,000011010100,000011010101,000011010110,000011010111,000001101100,000001101101,000011011010,000011011011,000001010100,000001010101,000001010110,000001010111," // 47
	+ "000001100100,000001100101,000001010010,000001010011,000000100100,000000110111,000000111000,000000100111,000000101000,000001011000,000001011001,000000101011,000000101100,000001011010,000001100110,000001100111";

	var makeW = "11011,10010,010111,0110111,00110110,00110111,01100100,01100101,01101000,01100111,011001100,011001101,011010010,011010011,011010100,011010101,011010110,"
	+ "011010111,011011000,011011001,011011010,011011011,010011000,010011001,010011010,011000,010011011";

	var makeB = "0000001111,000011001000,000011001001,000001011011,000000110011,000000110100,000000110101,0000001101100,0000001101101,0000001001010,0000001001011,0000001001100,"
	+ "0000001001101,0000001110010,0000001110011,0000001110100,0000001110101,0000001110110,0000001110111,0000001010010,0000001010011,0000001010100,0000001010101,0000001011010,"
	+ "0000001011011,0000001100100,0000001100101";

	var makeA = "00000001000,00000001100,00000001101,000000010010,000000010011,000000010100,000000010101,000000010110,000000010111,000000011100,000000011101,000000011110,000000011111";

	termW = termW.split(",");  termB = termB.split(",");  makeW = makeW.split(",");  makeB = makeB.split(",");  makeA = makeA.split(",");

	var lensW = {}, lensB = {};
	addKeys(lensW, termW, 0, 1);  addKeys(lensW, makeW, 64,64);  addKeys(lensW, makeA, 1792,64);
	addKeys(lensB, termB, 0, 1);  addKeys(lensB, makeB, 64,64);  addKeys(lensB, makeA, 1792,64);
	return [lensW, lensB];
} )();

UTIF.decode._decodeG4 = function(data, off, slen, tgt, toff, w, fo)
{
	var U = UTIF.decode, boff=off<<3, len=0, wrd="";	// previous starts with 1
	var line=[], pline=[];  for(var i=0; i<w; i++) pline.push(0);  pline=U._makeDiff(pline);
	var a0=0, a1=0, a2=0, b1=0, b2=0, clr=0;
	var y=0, mode="", toRead=0;
	var bipl = Math.ceil(w/8)*8;

	while((boff>>>3)<off+slen)
	{
		b1 = U._findDiff(pline, a0+(a0==0?0:1), 1-clr), b2 = U._findDiff(pline, b1, clr);	// could be precomputed
		var bit =0;
		if(fo==1) bit = (data[boff>>>3]>>>(7-(boff&7)))&1;
		if(fo==2) bit = (data[boff>>>3]>>>(  (boff&7)))&1;
		boff++;  wrd+=bit;
		if(mode=="H")
		{
			if(U._lens[clr][wrd]!=null)
			{
				var dl=U._lens[clr][wrd];  wrd="";  len+=dl;
				if(dl<64) {  U._addNtimes(line,len,clr);  a0+=len;  clr=1-clr;  len=0;  toRead--;  if(toRead==0) mode="";  }
			}
		}
		else
		{
			if(wrd=="0001")  {  wrd="";  U._addNtimes(line,b2-a0,clr);  a0=b2;   }
			if(wrd=="001" )  {  wrd="";  mode="H";  toRead=2;  }
			if(U._dmap[wrd]!=null) {  a1 = b1+U._dmap[wrd];  U._addNtimes(line, a1-a0, clr);  a0=a1;  wrd="";  clr=1-clr;  }
		}
		if(line.length==w && mode=="")
		{
			U._writeBits(line, tgt, toff*8+y*bipl);
			clr=0;  y++;  a0=0;
			pline=U._makeDiff(line);  line=[];
		}
		//if(wrd.length>150) {  log(wrd);  break;  throw "e";  }
	}
}

UTIF.decode._findDiff = function(line, x, clr) {  for(var i=0; i<line.length; i+=2) if(line[i]>=x && line[i+1]==clr)  return line[i];  }

UTIF.decode._makeDiff = function(line)
{
	var out = [];  if(line[0]==1) out.push(0,1);
	for(var i=1; i<line.length; i++) if(line[i-1]!=line[i]) out.push(i, line[i]);
	out.push(line.length,0,line.length,1);  return out;
}

UTIF.decode._decodeG3 = function(data, off, slen, tgt, toff, w, fo)
{
	var U = UTIF.decode, boff=off<<3, len=0, wrd="";
	var line=[], pline=[];  for(var i=0; i<w; i++) line.push(0);
	var a0=0, a1=0, a2=0, b1=0, b2=0, clr=0;
	var y=-1, mode="", toRead=0, is1D=false;
	var bipl = Math.ceil(w/8)*8;
	while((boff>>>3)<off+slen)
	{
		b1 = U._findDiff(pline, a0+(a0==0?0:1), 1-clr), b2 = U._findDiff(pline, b1, clr);	// could be precomputed
		var bit =0;
		if(fo==1) bit = (data[boff>>>3]>>>(7-(boff&7)))&1;
		if(fo==2) bit = (data[boff>>>3]>>>(  (boff&7)))&1;
		boff++;  wrd+=bit;

		if(is1D)
		{
			if(U._lens[clr][wrd]!=null)
			{
				var dl=U._lens[clr][wrd];  wrd="";  len+=dl;
				if(dl<64) {  U._addNtimes(line,len,clr);  clr=1-clr;  len=0;  }
			}
		}
		else
		{
			if(mode=="H")
			{
				if(U._lens[clr][wrd]!=null)
				{
					var dl=U._lens[clr][wrd];  wrd="";  len+=dl;
					if(dl<64) {  U._addNtimes(line,len,clr);  a0+=len;  clr=1-clr;  len=0;  toRead--;  if(toRead==0) mode="";  }
				}
			}
			else
			{
				if(wrd=="0001")  {  wrd="";  U._addNtimes(line,b2-a0,clr);  a0=b2;   }
				if(wrd=="001" )  {  wrd="";  mode="H";  toRead=2;  }
				if(U._dmap[wrd]!=null) {  a1 = b1+U._dmap[wrd];  U._addNtimes(line, a1-a0, clr);  a0=a1;  wrd="";  clr=1-clr;  }
			}
		}
		if(wrd.endsWith("000000000001")) // needed for some files
		{
			if(y>=0) U._writeBits(line, tgt, toff*8+y*bipl);
			if(fo==1) is1D = ((data[boff>>>3]>>>(7-(boff&7)))&1)==1;
			if(fo==2) is1D = ((data[boff>>>3]>>>(  (boff&7)))&1)==1;
			boff++;
			if(U._decodeG3.allow2D==null) U._decodeG3.allow2D=is1D;
			if(!U._decodeG3.allow2D) {  is1D = true;  boff--;  }
			//log("EOL",y, "next 1D:", is1D);
			wrd="";  clr=0;  y++;  a0=0;
			pline=U._makeDiff(line);  line=[];
		}
	}
	if(line.length==w) U._writeBits(line, tgt, toff*8+y*bipl);
}

UTIF.decode._addNtimes = function(arr, n, val) {  for(var i=0; i<n; i++) arr.push(val);  }

UTIF.decode._writeBits = function(bits, tgt, boff)
{
	for(var i=0; i<bits.length; i++) tgt[(boff+i)>>>3] |= (bits[i]<<(7-((boff+i)&7)));
}

UTIF.decode._decodeLZW = function(data, off, tgt, toff)
{
	if(UTIF.decode._lzwTab==null)
	{
		var tb=new Uint32Array(0xffff), tn=new Uint16Array(0xffff), chr=new Uint8Array(2e6);
		for(var i=0; i<256; i++) { chr[i<<2]=i;  tb[i]=i<<2;  tn[i]=1;  }
		UTIF.decode._lzwTab = [tb,tn,chr];
	}
	var copy = UTIF.decode._copyData;
	var tab = UTIF.decode._lzwTab[0], tln=UTIF.decode._lzwTab[1], chr=UTIF.decode._lzwTab[2], totl = 258, chrl = 258<<2;
	var bits = 9, boff = off<<3;  // offset in bits

	var ClearCode = 256, EoiCode = 257;
	var v = 0, Code = 0, OldCode = 0;
	while(true)
	{
		v = (data[boff>>>3]<<16) | (data[(boff+8)>>>3]<<8) | data[(boff+16)>>>3];
		Code = ( v>>(24-(boff&7)-bits) )    &   ((1<<bits)-1);  boff+=bits;

		if(Code==EoiCode) break;
		if(Code==ClearCode)
		{
			bits=9;  totl = 258;  chrl = 258<<2;

			v = (data[boff>>>3]<<16) | (data[(boff+8)>>>3]<<8) | data[(boff+16)>>>3];
			Code = ( v>>(24-(boff&7)-bits) )    &   ((1<<bits)-1);  boff+=bits;
			if(Code==EoiCode) break;
			tgt[toff]=Code;  toff++;
		}
		else if(Code<totl)
		{
			var cd = tab[Code], cl = tln[Code];
			copy(chr,cd,tgt,toff,cl);  toff += cl;

			if(OldCode>=totl) {  tab[totl] = chrl;  chr[tab[totl]] = cd[0];  tln[totl]=1;  chrl=(chrl+1+3)&~0x03;  totl++;  }
			else
			{
				tab[totl] = chrl;
				var nit = tab[OldCode], nil = tln[OldCode];
				copy(chr,nit,chr,chrl,nil);
				chr[chrl+nil]=chr[cd];  nil++;
				tln[totl]=nil;  totl++;

				chrl=(chrl+nil+3)&~0x03;
			}
			if(totl+1==(1<<bits)) bits++;
		}
		else
		{
			if(OldCode>=totl) {  tab[totl] = chrl;  tln[totl]=0;  totl++;  }
			else
			{
				tab[totl] = chrl;
				var nit = tab[OldCode], nil = tln[OldCode];
				copy(chr,nit,chr,chrl,nil);
				chr[chrl+nil]=chr[chrl];  nil++;
				tln[totl]=nil;  totl++;

				copy(chr,chrl,tgt,toff,nil);  toff += nil;
				chrl=(chrl+nil+3)&~0x03;
			}
			if(totl+1==(1<<bits)) bits++;
		}
		OldCode = Code;
	}
}

UTIF.decode._copyData = function(s,so,t,to,l) {  for(var i=0;i<l;i+=4) {  t[to+i]=s[so+i];  t[to+i+1]=s[so+i+1];  t[to+i+2]=s[so+i+2];  t[to+i+3]=s[so+i+3];  }  }

UTIF.tags = {};
UTIF.ttypes = {  256:3,257:3,258:3,   259:3, 262:3,  273:4,  274:3, 277:3,278:4,279:4, 282:5, 283:5, 284:3, 286:5,287:5, 296:3, 305:2, 306:2, 338:3, 513:4, 514:4, 34665:4  };

UTIF._readIFD = function(bin, data, offset, ifds, depth, debug)
{
	var cnt = bin.readUshort(data, offset);  offset+=2;
	var ifd = {};  ifds.push(ifd);

	if(debug) log("   ".repeat(depth),ifds.length-1,">>>----------------");
	for(var i=0; i<cnt; i++)
	{
		var tag  = bin.readUshort(data, offset);    offset+=2;
		var type = bin.readUshort(data, offset);    offset+=2;
		var num  = bin.readUint  (data, offset);    offset+=4;
		var voff = bin.readUint  (data, offset);    offset+=4;
		//if(tag==33723) {type=1; num*=4;}//console.log(type,num,voff);//type = 1;  // IPTC/NAA

		var arr = [];
		//ifd["t"+tag+"-"+UTIF.tags[tag]] = arr;
		if(type== 1 || type==7) {  arr = new Uint8Array(data.buffer, (num<5 ? offset-4 : voff), num);  }
		if(type== 2) {  var o0 = (num<5 ? offset-4 : voff), c=data[o0];  
						if(c<128) arr.push( bin.readASCII(data, o0, num-1) );
						else      arr = new Uint8Array(data.buffer, o0, num-1);  }
		if(type== 3) {  for(var j=0; j<num; j++) arr.push(bin.readUshort(data, (num<3 ? offset-4 : voff)+2*j));  }
		if(type== 4) {  for(var j=0; j<num; j++) arr.push(bin.readUint  (data, (num<2 ? offset-4 : voff)+4*j));  }
		if(type== 5) {  for(var j=0; j<num; j++) arr.push(bin.readUint  (data, voff+j*8) / bin.readUint(data,voff+j*8+4));  }
		if(type== 8) {  for(var j=0; j<num; j++) arr.push(bin.readShort (data, (num<3 ? offset-4 : voff)+2*j));  }
		if(type== 9) {  for(var j=0; j<num; j++) arr.push(bin.readInt   (data, (num<2 ? offset-4 : voff)+4*j));  }
		if(type==10) {  for(var j=0; j<num; j++) arr.push(bin.readInt   (data, voff+j*8) / bin.readInt (data,voff+j*8+4));  }
		if(type==11) {  for(var j=0; j<num; j++) arr.push(bin.readFloat (data, voff+j*4));  }
		if(type==12) {  for(var j=0; j<num; j++) arr.push(bin.readDouble(data, voff+j*8));  }
		
		ifd["t"+tag] = arr;
		
		if(num!=0 && arr.length==0) {  log("unknown TIFF tag type: ", type, "num:",num);  }
		if(debug) log("   ".repeat(depth), tag, type, UTIF.tags[tag], arr);
		
		if(tag==330 && ifd["t272"] && ifd["t272"][0]=="DSLR-A100") {  } 
		// ifd["t258"]=[12];  ifd["t259"]=[32767];  ifd["t273"]=[offset+arr[0]];  ifd["t277"]=[1];  ifd["t279"]=[1];  ifd["t33421"]=[2,2];  ifd["t33422"]=[0,1,1,2];
		else if(tag==330 || tag==34665 || (tag==50740 && bin.readUshort(data,bin.readUint(arr,0))<300  )) {
			var oarr = tag==50740 ? [bin.readUint(arr,0)] : arr;
			var subfd = [];
			for(var j=0; j<oarr.length; j++) UTIF._readIFD(bin, data, oarr[j], subfd, depth+1, debug);
			if(tag==  330) ifd.subIFD = subfd;
			if(tag==34665) ifd.exifIFD = subfd[0];
			if(tag==50740) ifd.dngPrvt = subfd[0];
		}
		if(tag==37500) {
			var mn = arr;
			//console.log(bin.readASCII(mn,0,mn.length), mn);
			if(bin.readASCII(mn,0,5)=="Nikon")  ifd.makerNote = UTIF["decode"](mn.slice(10).buffer)[0];
			else if(bin.readUshort(data,voff)<300){
				var subsub=[];  UTIF._readIFD(bin, data, voff, subsub, depth+1, debug);
				ifd.makerNote = subsub[0];
			}
		}
	}
	if(debug) log("   ".repeat(depth),"<<<---------------");
	return offset;
}

UTIF._writeIFD = function(bin, data, offset, ifd)
{
	var keys = Object.keys(ifd);
	bin.writeUshort(data, offset, keys.length);  offset+=2;

	var eoff = offset + keys.length*12 + 4;

	for(var ki=0; ki<keys.length; ki++)
	{
		var key = keys[ki];
		var tag = parseInt(key.slice(1)), type = UTIF.ttypes[tag];  if(type==null) throw new Error("unknown type of tag: "+tag);
		var val = ifd[key];  if(type==2) val=val[0]+"\u0000";  var num = val.length;
		bin.writeUshort(data, offset, tag );  offset+=2;
		bin.writeUshort(data, offset, type);  offset+=2;
		bin.writeUint  (data, offset, num );  offset+=4;

		var dlen = [-1, 1, 1, 2, 4, 8, 0, 0, 0, 0, 0, 0, 8][type] * num;
		var toff = offset;
		if(dlen>4) {  bin.writeUint(data, offset, eoff);  toff=eoff;  }

		if(type==2) {  bin.writeASCII(data, toff, val);   }
		if(type==3) {  for(var i=0; i<num; i++) bin.writeUshort(data, toff+2*i, val[i]);    }
		if(type==4) {  for(var i=0; i<num; i++) bin.writeUint  (data, toff+4*i, val[i]);    }
		if(type==5) {  for(var i=0; i<num; i++) {  bin.writeUint(data, toff+8*i, Math.round(val[i]*10000));  bin.writeUint(data, toff+8*i+4, 10000);  }   }
		if (type == 12) {  for (var i = 0; i < num; i++) bin.writeDouble(data, toff + 8 * i, val[i]); }

		if(dlen>4) {  dlen += (dlen&1);  eoff += dlen;  }
		offset += 4;
	}
	return [offset, eoff];
}

UTIF.toRGBA8 = function(out)
{
	var w = out.width, h = out.height, area = w*h, qarea = area*4, data = out.data;
	var img = new Uint8Array(area*4);
	//console.log(out);
	// 0: WhiteIsZero, 1: BlackIsZero, 2: RGB, 3: Palette color, 4: Transparency mask, 5: CMYK
	var intp = (out["t262"] ? out["t262"][0]: 2), bps = (out["t258"]?Math.min(32,out["t258"][0]):1);
	//log("interpretation: ", intp, "bps", bps, out);
	if(false) {}
	else if(intp==0)
	{
		var bpl = Math.ceil(bps*w/8);
		for(var y=0; y<h; y++) {
			var off = y*bpl, io = y*w;
			if(bps== 1) for(var i=0; i<w; i++) {  var qi=(io+i)<<2, px=((data[off+(i>>3)])>>(7-  (i&7)))& 1;  img[qi]=img[qi+1]=img[qi+2]=( 1-px)*255;  img[qi+3]=255;    }
			if(bps== 4) for(var i=0; i<w; i++) {  var qi=(io+i)<<2, px=((data[off+(i>>1)])>>(4-4*(i&1)))&15;  img[qi]=img[qi+1]=img[qi+2]=(15-px)* 17;  img[qi+3]=255;    }
			if(bps== 8) for(var i=0; i<w; i++) {  var qi=(io+i)<<2, px=data[off+i];  img[qi]=img[qi+1]=img[qi+2]=255-px;  img[qi+3]=255;    }
		}
	}
	else if(intp==1)
	{
		var bpl = Math.ceil(bps*w/8);
		for(var y=0; y<h; y++) {
			var off = y*bpl, io = y*w;
			if(bps== 1) for(var i=0; i<w; i++) {  var qi=(io+i)<<2, px=((data[off+(i>>3)])>>(7-  (i&7)))&1;   img[qi]=img[qi+1]=img[qi+2]=(px)*255;  img[qi+3]=255;    }
			if(bps== 2) for(var i=0; i<w; i++) {  var qi=(io+i)<<2, px=((data[off+(i>>2)])>>(6-2*(i&3)))&3;   img[qi]=img[qi+1]=img[qi+2]=(px)* 85;  img[qi+3]=255;    }
			if(bps== 8) for(var i=0; i<w; i++) {  var qi=(io+i)<<2, px=data[off+i];  img[qi]=img[qi+1]=img[qi+2]=    px;  img[qi+3]=255;    }
			if(bps==16) for(var i=0; i<w; i++) {  var qi=(io+i)<<2, px=data[off+(2*i+1)];  img[qi]=img[qi+1]=img[qi+2]= Math.min(255,px);  img[qi+3]=255;    } // ladoga.tif
		}
	}
	else if(intp==2)
	{
		var smpls = out["t258"]?out["t258"].length : 3;
		
		if(bps== 8) 
		{
			if(smpls==4) for(var i=0; i<qarea; i++) img[i] = data[i];
			if(smpls==3) for(var i=0; i< area; i++) {  var qi=i<<2, ti=i*3;  img[qi]=data[ti];  img[qi+1]=data[ti+1];  img[qi+2]=data[ti+2];  img[qi+3]=255;    }
		}
		else{  // 3x 16-bit channel
			if(smpls==4) for(var i=0; i<area; i++) {  var qi=i<<2, ti=i*8+1;  img[qi]=data[ti];  img[qi+1]=data[ti+2];  img[qi+2]=data[ti+4];  img[qi+3]=data[ti+6];    }
			if(smpls==3) for(var i=0; i<area; i++) {  var qi=i<<2, ti=i*6+1;  img[qi]=data[ti];  img[qi+1]=data[ti+2];  img[qi+2]=data[ti+4];  img[qi+3]=255;           }
		}
	}
	else if(intp==3)
	{
		var map = out["t320"];
		for(var i=0; i<area; i++) {  var qi=i<<2, mi=data[i];  img[qi]=(map[mi]>>8);  img[qi+1]=(map[256+mi]>>8);  img[qi+2]=(map[512+mi]>>8);  img[qi+3]=255;    }
	}
	else if(intp==5) 
	{
		var smpls = out["t258"]?out["t258"].length : 4;
		var gotAlpha = smpls>4 ? 1 : 0;
		for(var i=0; i<area; i++) {
			var qi=i<<2, si=i*smpls;  var C=255-data[si], M=255-data[si+1], Y=255-data[si+2], K=(255-data[si+3])*(1/255);
			img[qi]=~~(C*K+0.5);  img[qi+1]=~~(M*K+0.5);  img[qi+2]=~~(Y*K+0.5);  img[qi+3]=255*(1-gotAlpha)+data[si+4]*gotAlpha;
		}
	}
	else log("Unknown Photometric interpretation: "+intp);
	return img;
}

UTIF.replaceIMG = function(imgs)
{
	if(imgs==null) imgs = document.getElementsByTagName("img");
	var sufs = ["tif","tiff","dng","cr2","nef"]
	for (var i=0; i<imgs.length; i++)
	{
		var img=imgs[i], src=img.getAttribute("src");  if(src==null) continue;
		var suff=src.split(".").pop().toLowerCase();
		if(sufs.indexOf(suff)==-1) continue;
		var xhr = new XMLHttpRequest();  UTIF._xhrs.push(xhr);  UTIF._imgs.push(img);
		xhr.open("GET", src);  xhr.responseType = "arraybuffer";
		xhr.onload = UTIF._imgLoaded;   xhr.send();
	}
}

UTIF._xhrs = [];  UTIF._imgs = [];
UTIF._imgLoaded = function(e)
{
	var buff = e.target.response;
	var ifds = UTIF.decode(buff);  //console.log(ifds);
	var vsns = ifds, ma=0, page=vsns[0];  if(ifds[0].subIFD) vsns = vsns.concat(ifds[0].subIFD);
	for(var i=0; i<vsns.length; i++) {
		var img = vsns[i];
		if(img["t258"]==null || img["t258"].length<3) continue;
		var ar = img["t256"]*img["t257"];
		if(ar>ma) {  ma=ar;  page=img;  }
	}
	UTIF.decodeImage(buff, page, ifds);
	var rgba = UTIF.toRGBA8(page), w=page.width, h=page.height;
	var ind = UTIF._xhrs.indexOf(e.target), img = UTIF._imgs[ind];
	UTIF._xhrs.splice(ind,1);  UTIF._imgs.splice(ind,1);
	var cnv = document.createElement("canvas");  cnv.width=w;  cnv.height=h;
	var ctx = cnv.getContext("2d"), imgd = ctx.createImageData(w,h);
	for(var i=0; i<rgba.length; i++) imgd.data[i]=rgba[i];       ctx.putImageData(imgd,0,0);
	img.setAttribute("src",cnv.toDataURL());
}


UTIF._binBE =
{
	nextZero   : function(data, o) {  while(data[o]!=0) o++;  return o;  },
	readUshort : function(buff, p) {  return (buff[p]<< 8) |  buff[p+1];  },
	readShort  : function(buff, p) {  var a=UTIF._binBE.ui8;  a[0]=buff[p+1];  a[1]=buff[p+0];                                    return UTIF._binBE. i16[0];  },
	readInt    : function(buff, p) {  var a=UTIF._binBE.ui8;  a[0]=buff[p+3];  a[1]=buff[p+2];  a[2]=buff[p+1];  a[3]=buff[p+0];  return UTIF._binBE. i32[0];  },
	readUint   : function(buff, p) {  var a=UTIF._binBE.ui8;  a[0]=buff[p+3];  a[1]=buff[p+2];  a[2]=buff[p+1];  a[3]=buff[p+0];  return UTIF._binBE.ui32[0];  },
	readASCII  : function(buff, p, l) {  var s = "";   for(var i=0; i<l; i++) s += String.fromCharCode(buff[p+i]);   return s; },
	readFloat  : function(buff, p) {  var a=UTIF._binBE.ui8;  for(var i=0;i<4;i++) a[i]=buff[p+3-i];  return UTIF._binBE.fl32[0];  },
	readDouble : function(buff, p) {  var a=UTIF._binBE.ui8;  for(var i=0;i<8;i++) a[i]=buff[p+7-i];  return UTIF._binBE.fl64[0];  },

	writeUshort: function(buff, p, n) {  buff[p] = (n>> 8)&255;  buff[p+1] =  n&255;  },
	writeUint  : function(buff, p, n) {  buff[p] = (n>>24)&255;  buff[p+1] = (n>>16)&255;  buff[p+2] = (n>>8)&255;  buff[p+3] = (n>>0)&255;  },
	writeASCII : function(buff, p, s) {  for(var i = 0; i < s.length; i++)  buff[p+i] = s.charCodeAt(i);  },
	writeDouble: function(buff, p, n)
	{
		UTIF._binBE.fl64[0] = n;
		for (var i = 0; i < 8; i++) buff[p + i] = UTIF._binBE.ui8[7 - i];
	}
}
UTIF._binBE.ui8  = new Uint8Array  (8);
UTIF._binBE.i16  = new Int16Array  (UTIF._binBE.ui8.buffer);
UTIF._binBE.i32  = new Int32Array  (UTIF._binBE.ui8.buffer);
UTIF._binBE.ui32 = new Uint32Array (UTIF._binBE.ui8.buffer);
UTIF._binBE.fl32 = new Float32Array(UTIF._binBE.ui8.buffer);
UTIF._binBE.fl64 = new Float64Array(UTIF._binBE.ui8.buffer);

UTIF._binLE =
{
	nextZero   : UTIF._binBE.nextZero,
	readUshort : function(buff, p) {  return (buff[p+1]<< 8) |  buff[p];  },
	readShort  : function(buff, p) {  var a=UTIF._binBE.ui8;  a[0]=buff[p+0];  a[1]=buff[p+1];                                    return UTIF._binBE. i16[0];  },
	readInt    : function(buff, p) {  var a=UTIF._binBE.ui8;  a[0]=buff[p+0];  a[1]=buff[p+1];  a[2]=buff[p+2];  a[3]=buff[p+3];  return UTIF._binBE. i32[0];  },
	readUint   : function(buff, p) {  var a=UTIF._binBE.ui8;  a[0]=buff[p+0];  a[1]=buff[p+1];  a[2]=buff[p+2];  a[3]=buff[p+3];  return UTIF._binBE.ui32[0];  },
	readASCII  : UTIF._binBE.readASCII,
	readFloat  : function(buff, p) {  var a=UTIF._binBE.ui8;  for(var i=0;i<4;i++) a[i]=buff[p+  i];  return UTIF._binBE.fl32[0];  },
	readDouble : function(buff, p) {  var a=UTIF._binBE.ui8;  for(var i=0;i<8;i++) a[i]=buff[p+  i];  return UTIF._binBE.fl64[0];  }
}
UTIF._copyTile = function(tb, tw, th, b, w, h, xoff, yoff)
{
	//log("copyTile", tw, th,  w, h, xoff, yoff);
	var xlim = Math.min(tw, w-xoff);
	var ylim = Math.min(th, h-yoff);
	for(var y=0; y<ylim; y++)
	{
		var tof = (yoff+y)*w+xoff;
		var sof = y*tw;
		for(var x=0; x<xlim; x++) b[tof+x] = tb[sof+x];
	}
}

UTIF.LosslessJpegDecode = (function(){function t(Z){this.w=Z;this.N=0;this._=0;this.G=0}t.prototype={t:function(Z){this.N=Math.max(0,Math.min(this.w.length,Z))},i:function(){return this.w[this.N++]},l:function(){var Z=this.N;
this.N+=2;return this.w[Z]<<8|this.w[Z+1]},J:function(){if(this._==0){this.G=this.w[this.N];this.N+=1+(this.G+1>>>8);
this._=8}return this.G>>>--this._&1},Z:function(Z){var X=this._,s=this.G,E=Math.min(X,Z);Z-=E;X-=E;var Y=s>>>X&(1<<E)-1;
while(Z>0){s=this.w[this.N];this.N+=1+(s+1>>>8);E=Math.min(8,Z);Z-=E;X=8-E;Y<<=E;Y|=s>>>X&(1<<E)-1}this._=X;
this.G=s;return Y}};var i={};i.X=function(){return[0,0,-1]};i.s=function(Z,X,s){Z[i.Y(Z,0,s)+2]=X};i.Y=function(Z,X,s){if(Z[X+2]!=-1)return 0;
if(s==0)return X;for(var E=0;E<2;E++){if(Z[X+E]==0){Z[X+E]=Z.length;Z.push(0);Z.push(0);Z.push(-1)}var Y=i.Y(Z,Z[X+E],s-1);
if(Y!=0)return Y}return 0};i.B=function(Z,X){var s=0,E=0,Y=0,B=X._,$=X.G,e=X.N;while(!0){if(B==0){$=X.w[e];
e+=1+($+1>>>8);B=8}Y=$>>>--B&1;s=Z[s+Y];E=Z[s+2];if(E!=-1){X._=B;X.G=$;X.N=e;return E}}return-1};function l(Z){this.z=new t(Z);
this.D(this.z)}l.prototype={$:function(Z,X){this.Q=Z.i();this.F=Z.l();this.o=Z.l();var s=this.O=Z.i();
this.L=[];for(var E=0;E<s;E++){var Y=Z.i(),B=Z.i();Z.i();this.L[Y]=E}Z.t(Z.N+X-(6+s*3))},e:function(){var Z=0,X=this.z.i();
if(this.H==null)this.H={};var s=this.H[X]=i.X(),E=[];for(var Y=0;Y<16;Y++){E[Y]=this.z.i();Z+=E[Y]}for(var Y=0;
Y<16;Y++)for(var B=0;B<E[Y];B++)i.s(s,this.z.i(),Y+1);return Z+17},W:function(Z){while(Z>0)Z-=this.e()},p:function(Z,X){var s=Z.i();
if(!this.U){this.U=[]}for(var E=0;E<s;E++){var Y=Z.i(),B=Z.i();this.U[this.L[Y]]=this.H[B>>>4]}this.g=Z.i();
Z.t(Z.N+X-(2+s*2))},D:function(Z){var X=!1,s=Z.l();if(s!==l.q)return;do{var s=Z.l(),E=Z.l()-2;switch(s){case l.m:this.$(Z,E);
break;case l.K:this.W(E);break;case l.V:this.p(Z,E);X=!0;break;default:Z.t(Z.N+E);break}}while(!X)},I:function(Z,X){var s=i.B(X,Z);
if(s==16)return-32768;var E=Z.Z(s);if((E&1<<s-1)==0)E-=(1<<s)-1;return E},B:function(Z,X){var s=this.z,E=this.O,Y=this.F,B=this.I,$=this.g,e=this.o*E,W=this.U;
for(var p=0;p<E;p++){Z[p]=B(s,W[p])+(1<<this.Q-1)}for(var D=E;D<e;D+=E){for(var p=0;p<E;p++)Z[D+p]=B(s,W[p])+Z[D+p-E]}var I=X;
for(var m=1;m<Y;m++){for(var p=0;p<E;p++){Z[I+p]=B(s,W[p])+Z[I+p-X]}for(var D=E;D<e;D+=E){for(var p=0;
p<E;p++){var K=I+D+p,q=Z[K-E];if($==6)q=Z[K-X]+(q-Z[K-E-X]>>>1);Z[K]=q+B(s,W[p])}}I+=X}}};l.m=65475;
l.K=65476;l.q=65496;l.V=65498;function J(Z){var X=new l(Z),s=X.Q>8?Uint16Array:Uint8Array,E=new s(X.o*X.F*X.O),Y=X.o*X.O;
X.B(E,Y);return E}return J}())




})(UTIF, pako);
return UTIF;
})();

async function decodeFile(file) {
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
// (empty background reads as no signal, consistent with the dark-band-positive convention).
function bilinear(sig, W, H, x, y) {
  if (x < 0 || y < 0 || x > W - 1 || y > H - 1) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const a = sig[y0 * W + x0], b = sig[y0 * W + x1];
  const c = sig[y1 * W + x0], d = sig[y1 * W + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}

// Straighten the original image at angle `deg` (rotation pivot = original image centre)
// and optionally CROP to `cropRect` (a sub-rectangle in straightened full-frame coords).
//
// - cropRect null  → v8 behaviour: full-frame straighten into a W×H buffer (view never
//   zooms; the EMSA area is a separate sub-rect ROI).
// - cropRect set   → straighten + sample ONLY that window into a cropRect.w×cropRect.h
//   buffer (a destructive, zooming crop). Because the rotation field is the same full
//   straightened frame in both cases, we just window the identical sub-rect out of both
//   the float signal and the display canvas, so signal and display stay aligned. The crop
//   is a window into the straightened frame, so re-straightening (rotation) about the
//   image centre keeps the same window valid for small angle tweaks.
//
// Signal is bilinear-resampled from the float baseSignal (preserves 16-bit/TIFF depth);
// the display is a canvas rotate of the 8-bit original.
async function buildWorkBuffer(baseSignal, origDisplaySrc, deg, cropRect = null) {
  const { sig, W, H } = baseSignal;
  const cx = W / 2, cy = H / 2;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);

  const outW = cropRect ? cropRect.w : W;
  const outH = cropRect ? cropRect.h : H;
  const ox0 = cropRect ? cropRect.x : 0; // window origin in straightened full-frame coords
  const oy0 = cropRect ? cropRect.y : 0;

  // ---- Signal: bilinear resample from the float base signal ----
  let workSig = null;
  if (sig) {
    workSig = new Float32Array(outW * outH);
    for (let v = 0; v < outH; v++) {
      const dv = (oy0 + v) - cy; // straightened-frame row offset from centre
      for (let u = 0; u < outW; u++) {
        const du = (ox0 + u) - cx;
        const ox = cx + du * cos - dv * sin;
        const oy = cy + du * sin + dv * cos;
        workSig[v * outW + u] = bilinear(sig, W, H, ox, oy);
      }
    }
  }

  // ---- Display: canvas rotate (-a straightens) of the 8-bit original ----
  const im = await loadImage(origDisplaySrc);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.translate(cx, cy);
  ctx.rotate(-a);
  ctx.translate(-cx, -cy);
  ctx.drawImage(im, 0, 0);

  let displayUrl;
  if (cropRect) {
    // Window the identical sub-rect out of the straightened display canvas.
    const cc = document.createElement("canvas");
    cc.width = outW; cc.height = outH;
    const cctx = cc.getContext("2d");
    cctx.drawImage(c, ox0, oy0, outW, outH, 0, 0, outW, outH);
    displayUrl = cc.toDataURL("image/png");
  } else {
    displayUrl = c.toDataURL("image/png");
  }

  return { displayUrl, workSig, W: outW, H: outH };
}

function findGelROI(sig, W, H) {
  const sample = [];
  const step = Math.max(1, Math.floor((W * H) / 50000));
  for (let i = 0; i < sig.length; i += step) sample.push(sig[i]);
  sample.sort((a, b) => a - b);
  const p90 = sample[Math.floor(sample.length * 0.9)];
  const thr = Math.max(0.05, p90 * 0.25);

  let xMin = W, xMax = 0, yMin = H, yMax = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (sig[y * W + x] > thr) {
        if (x < xMin) xMin = x;
        if (x > xMax) xMax = x;
        if (y < yMin) yMin = y;
        if (y > yMax) yMax = y;
      }
    }
  }
  if (xMax < xMin || yMax < yMin) return { x: 0, y: 0, w: W, h: H };
  const padX = Math.round((xMax - xMin) * 0.04);
  const padY = Math.round((yMax - yMin) * 0.04);
  return {
    x: Math.max(0, xMin - padX),
    y: Math.max(0, yMin - padY),
    w: Math.min(W, xMax + padX) - Math.max(0, xMin - padX),
    h: Math.min(H, yMax + padY) - Math.max(0, yMin - padY),
  };
}

function columnProfile(sig, W, roi) {
  const prof = new Float32Array(roi.w);
  for (let dx = 0; dx < roi.w; dx++) {
    let s = 0;
    const x = roi.x + dx;
    for (let dy = 0; dy < roi.h; dy++) s += sig[(roi.y + dy) * W + x];
    prof[dx] = s / roi.h;
  }
  return prof;
}

function smooth(arr, w) {
  const n = arr.length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0, c = 0;
    for (let j = -w; j <= w; j++) {
      const k = i + j;
      if (k >= 0 && k < n) { s += arr[k]; c++; }
    }
    out[i] = s / c;
  }
  return out;
}

function findPeaks(arr, { minProminence = 0.02, minDist = 5 } = {}) {
  const n = arr.length;
  const cands = [];
  for (let i = 1; i < n - 1; i++) {
    if (arr[i] > arr[i - 1] && arr[i] >= arr[i + 1]) {
      let lMin = arr[i], rMin = arr[i];
      for (let j = i - 1; j >= 0; j--) {
        if (arr[j] > arr[i]) break;
        if (arr[j] < lMin) lMin = arr[j];
      }
      for (let j = i + 1; j < n; j++) {
        if (arr[j] > arr[i]) break;
        if (arr[j] < rMin) rMin = arr[j];
      }
      const prom = arr[i] - Math.max(lMin, rMin);
      if (prom >= minProminence) cands.push({ x: i, y: arr[i], prom });
    }
  }
  cands.sort((a, b) => b.prom - a.prom);
  const kept = [];
  for (const c of cands) {
    if (kept.every((k) => Math.abs(k.x - c.x) >= minDist)) kept.push(c);
  }
  kept.sort((a, b) => a.x - b.x);
  return kept;
}

// ---- Background subtraction: per-lane Asymmetric Least Squares (ALS) baseline ----
//
// We treat each lane as a 1-D vertical density profile (mean signal per row across the
// lane strip) and fit a smooth baseline that runs *under* the bands. ALS (Eilers &
// Boelens 2005) minimises  Σ wᵢ(yᵢ−zᵢ)² + λ Σ(Δ²zᵢ)²  with asymmetric weights:
// points above the current baseline (peaks) get weight p≪1, points below get 1−p, so the
// baseline ignores bands and follows the true background — including a vertical gradient.
// Each iteration solves (W + λ·DᵀD)·z = W·y, a symmetric pentadiagonal system, via a
// banded Cholesky (O(n) per solve). This replaces the old percentile / flat-mean schemes:
// it is robust, needs no user-drawn region, and handles top-to-bottom gradients per lane.

// Build the lane vertical profile: per-row mean over the strip [x1,x2) within the ROI,
// honouring pixel exclusions. Returns row sums, included counts, and means (length roi.h).
function laneProfile(sig, W, roi, x1, x2, isExcluded) {
  const h = roi.h;
  const rowSum = new Float64Array(h);
  const counts = new Int32Array(h);
  const mean = new Float64Array(h);
  for (let dy = 0; dy < h; dy++) {
    const y = roi.y + dy;
    let s = 0, n = 0;
    for (let x = x1; x < x2; x++) {
      if (isExcluded && isExcluded(x, y)) continue;
      s += sig[y * W + x];
      n++;
    }
    rowSum[dy] = s;
    counts[dy] = n;
    mean[dy] = n > 0 ? s / n : NaN;
  }
  // Fill any fully-excluded rows by carrying the nearest valid neighbour so ALS sees a
  // continuous profile (these rows contribute 0 area to integration anyway).
  let last = 0;
  for (let i = 0; i < h; i++) { if (Number.isNaN(mean[i])) mean[i] = last; else last = mean[i]; }
  for (let i = h - 1; i >= 0; i--) { if (mean[i] === 0 && counts[i] === 0 && i + 1 < h) mean[i] = mean[i + 1]; }
  return { rowSum, counts, mean };
}

// Asymmetric Least Squares baseline of a 1-D profile y.
//   lambda — smoothness/stiffness (larger = straighter baseline)
//   p      — asymmetry (smaller = hugs the valleys, ignores peaks more aggressively)
function alsBaseline(y, lambda, p, niter = 10) {
  const n = y.length;
  const z = new Float64Array(n);
  if (n < 3) { for (let i = 0; i < n; i++) z[i] = y[i]; return z; }

  // Second-difference penalty DᵀD as constant lower-banded diagonals (bandwidth 2).
  const dtd0 = new Float64Array(n); // main diagonal
  const dtd1 = new Float64Array(n); // (i, i-1)
  const dtd2 = new Float64Array(n); // (i, i-2)
  for (let k = 0; k < n - 2; k++) {
    dtd0[k] += 1; dtd0[k + 1] += 4; dtd0[k + 2] += 1;
    dtd1[k + 1] += -2; dtd1[k + 2] += -2;
    dtd2[k + 2] += 1;
  }

  const w = new Float64Array(n).fill(1);
  const a0 = new Float64Array(n), a1 = new Float64Array(n), a2 = new Float64Array(n);
  const L0 = new Float64Array(n), L1 = new Float64Array(n), L2 = new Float64Array(n);
  const u = new Float64Array(n), rhs = new Float64Array(n);

  for (let it = 0; it < niter; it++) {
    for (let i = 0; i < n; i++) {
      a0[i] = w[i] + lambda * dtd0[i];
      a1[i] = lambda * dtd1[i];
      a2[i] = lambda * dtd2[i];
      rhs[i] = w[i] * y[i];
    }
    // Banded Cholesky A = L·Lᵀ (L lower, bandwidth 2)
    for (let i = 0; i < n; i++) {
      L2[i] = i >= 2 ? a2[i] / L0[i - 2] : 0;
      L1[i] = i >= 1 ? (a1[i] - (i >= 2 ? L2[i] * L1[i - 1] : 0)) / L0[i - 1] : 0;
      let d = a0[i] - (i >= 1 ? L1[i] * L1[i] : 0) - (i >= 2 ? L2[i] * L2[i] : 0);
      L0[i] = Math.sqrt(d > 1e-12 ? d : 1e-12);
    }
    // Forward: L·u = rhs
    for (let i = 0; i < n; i++) {
      let s = rhs[i];
      if (i >= 1) s -= L1[i] * u[i - 1];
      if (i >= 2) s -= L2[i] * u[i - 2];
      u[i] = s / L0[i];
    }
    // Back: Lᵀ·z = u
    for (let i = n - 1; i >= 0; i--) {
      let s = u[i];
      if (i + 1 < n) s -= L1[i + 1] * z[i + 1];
      if (i + 2 < n) s -= L2[i + 2] * z[i + 2];
      z[i] = s / L0[i];
    }
    // Asymmetric weight update
    for (let i = 0; i < n; i++) w[i] = y[i] > z[i] ? p : (1 - p);
  }
  return z;
}

// Integrate one band box against a per-row baseline. yTop/yBot are absolute image rows.
// net = Σ_rows ( rowSum − baseline[row]·includedCount[row] ). Signed (no per-pixel clamp).
function integrateBox(rowSum, counts, baseline, roiY, yTop, yBot) {
  const h = rowSum.length;
  let raw = 0, net = 0, area = 0;
  const d0 = Math.max(0, Math.round(yTop) - roiY);
  const d1 = Math.min(h, Math.round(yBot) - roiY);
  for (let dy = d0; dy < d1; dy++) {
    raw += rowSum[dy];
    area += counts[dy];
    net += rowSum[dy] - baseline[dy] * counts[dy];
  }
  return { raw, net, area };
}

// ---- Global background: sliding-paraboloid rolling ball (Sternberg / ImageJ-style) ----
//
// A paraboloid of curvature c = 1/r² is "rolled" under the intensity surface; the locus of
// its top is the background. Equivalent to a grayscale morphological OPENING with a
// parabolic structuring element. We do it the sliding-paraboloid way: a 1-D parabolic
// opening along every row, then along every column (separable directional passes), which is
// O(W·H) per direction. The 1-D parabolic erosion is the lower envelope of upward parabolas
// f(q)+c(p−q)², computed in linear time by the Felzenszwalb–Huttenlocher algorithm;
// dilation is −erosion(−·), and opening = dilation(erosion(·)). Because an opening never
// exceeds the original, the corrected signal (original − background) is ≥ 0 by construction.
// Handles 2-D illumination/staining gradients that a per-lane 1-D method cannot see.

// 1-D parabolic erosion (lower envelope). Scratch arrays v (Int32 ≥n) and z (Float64 ≥n+1).
function parabErode1D(f, n, c, out, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s;
    while (true) {
      const vk = v[k];
      s = ((f[q] + c * q * q) - (f[vk] + c * vk * vk)) / (2 * c * (q - vk));
      if (s <= z[k]) k--; else break;
    }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0;
  for (let p = 0; p < n; p++) {
    while (z[k + 1] < p) k++;
    const vk = v[k];
    out[p] = f[vk] + c * (p - vk) * (p - vk);
  }
}

// 1-D parabolic opening in place on `line` (length n). e/neg are scratch (≥n).
function parabOpenLine(line, n, c, e, neg, v, z) {
  parabErode1D(line, n, c, e, v, z);        // erosion → e
  for (let i = 0; i < n; i++) neg[i] = -e[i];
  parabErode1D(neg, n, c, line, v, z);      // erosion of −e → line
  for (let i = 0; i < n; i++) line[i] = -line[i]; // dilation = −erode(−e); line ← opening
}

// Returns the rolling-ball background as a Float32Array (same layout as sig). radius in px.
function rollingBallBackground(sig, W, H, radius) {
  const c = 1 / (radius * radius);
  const bg = new Float64Array(W * H);
  for (let i = 0; i < W * H; i++) bg[i] = sig[i];
  const maxDim = Math.max(W, H);
  const line = new Float64Array(maxDim);
  const e = new Float64Array(maxDim);
  const neg = new Float64Array(maxDim);
  const v = new Int32Array(maxDim);
  const z = new Float64Array(maxDim + 1);
  for (let y = 0; y < H; y++) {            // along rows (x)
    const base = y * W;
    for (let x = 0; x < W; x++) line[x] = bg[base + x];
    parabOpenLine(line, W, c, e, neg, v, z);
    for (let x = 0; x < W; x++) bg[base + x] = line[x];
  }
  for (let x = 0; x < W; x++) {            // along columns (y)
    for (let y = 0; y < H; y++) line[y] = bg[y * W + x];
    parabOpenLine(line, H, c, e, neg, v, z);
    for (let y = 0; y < H; y++) bg[y * W + x] = line[y];
  }
  const out = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) out[i] = bg[i];
  return out;
}

/* ====================================================================
   Curve fitting
   ==================================================================== */

function nelderMead(f, x0, opts = {}) {
  const { maxIter = 800, tol = 1e-9, step = 0.1 } = opts;
  const n = x0.length;
  const alpha = 1, gamma = 2, rho = 0.5, sigma = 0.5;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] = p[i] + (p[i] === 0 ? step : Math.abs(p[i]) * step);
    simplex.push(p);
  }
  let vals = simplex.map(f);
  for (let iter = 0; iter < maxIter; iter++) {
    const order = vals.map((v, i) => i).sort((a, b) => vals[a] - vals[b]);
    simplex = order.map((i) => simplex[i]);
    vals = order.map((i) => vals[i]);
    if (Math.abs(vals[n] - vals[0]) < tol) break;
    const cen = new Array(n).fill(0);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) cen[j] += simplex[i][j];
    for (let j = 0; j < n; j++) cen[j] /= n;
    const xr = cen.map((c, j) => c + alpha * (c - simplex[n][j]));
    const fr = f(xr);
    if (fr < vals[n - 1] && fr >= vals[0]) {
      simplex[n] = xr; vals[n] = fr; continue;
    }
    if (fr < vals[0]) {
      const xe = cen.map((c, j) => c + gamma * (xr[j] - c));
      const fe = f(xe);
      if (fe < fr) { simplex[n] = xe; vals[n] = fe; }
      else { simplex[n] = xr; vals[n] = fr; }
      continue;
    }
    const xc = cen.map((c, j) => c + rho * (simplex[n][j] - c));
    const fc = f(xc);
    if (fc < vals[n]) { simplex[n] = xc; vals[n] = fc; continue; }
    for (let i = 1; i <= n; i++) {
      simplex[i] = simplex[0].map((x, j) => x + sigma * (simplex[i][j] - x));
      vals[i] = f(simplex[i]);
    }
  }
  return { x: simplex[0], fx: vals[0] };
}

function fitBinding(xs, ys, { model: modelKind = "hill", D = null, maxIter = 1600 } = {}) {
  const finite = xs
    .map((x, i) => [x, ys[i]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0);
  if (finite.length < 3) return null;
  const X = finite.map((p) => p[0]);
  const Y = finite.map((p) => p[1]);
  const yMax = Math.max(...Y);
  const yMin = Math.min(...Y);
  const yHalf = (yMin + yMax) / 2;
  let xHalf = X[Math.floor(X.length / 2)] || 1;
  for (let i = 0; i < Y.length; i++) {
    if (Y[i] >= yHalf && X[i] > 0) { xHalf = X[i]; break; }
  }

  const hill = modelKind === "hill";
  const quad = modelKind === "quadratic";
  // Tight-binding requires a known probe/DNA concentration; without it the fit is undefined.
  if (quad && (!Number.isFinite(D) || D <= 0)) return null;

  // Normalised 0→1 binding shape g(x). Quadratic/tight-binding uses the numerically-stable
  // 2[P]/(([P]+[D]+Kd)+sqrt(...)) form (avoids cancellation as [D]→0, reduces to hyperbolic).
  const shape = hill
    ? (x, K, n) => Math.pow(x, n) / (Math.pow(K, n) + Math.pow(x, n))
    : quad
    ? (x, K) => { const s = x + D + K; const disc = Math.max(0, s * s - 4 * x * D); return (2 * x) / (s + Math.sqrt(disc)); }
    : (x, K) => x / (K + x);

  // Parameters: [bottom, top, Kd, (n)]. The curve is bottom + (top−bottom)·g(x).
  //   bottom — apparent signal at [P]=0 (probe behaviour / non-specific), constrained ≥ 0.
  //   top    — true plateau (absolute fraction bound), constrained ≤ 1.
  // Kd comes from the SHAPE and is unaffected by the affine bottom/top, so modelling the
  // offset instead of forcing the curve through 0 (or hand-subtracting it) keeps Kd unbiased.
  const bottom0 = Math.max(0, Math.min(0.9, yMin));
  const top0 = Math.min(1, Math.max(bottom0 + 0.05, yMax));
  const init = hill
    ? [bottom0, top0, Math.max(1e-6, xHalf), 1.0]
    : [bottom0, top0, Math.max(1e-6, xHalf)];

  const clamp = (p) => {
    const bottom = Math.max(0, p[0]);
    let top = Math.min(1, p[1]);
    if (top < bottom) top = bottom;            // span ≥ 0
    const K = Math.abs(p[2]) || 1e-9;          // Kd > 0
    if (hill) return [bottom, top, K, Math.max(0.05, p[3])];
    return [bottom, top, K];
  };
  const evalModel = (x, p) =>
    p[0] + (p[1] - p[0]) * (hill ? shape(x, p[2], p[3]) : shape(x, p[2]));

  // Box-constrained Nelder–Mead: evaluate at the feasible projection of p and penalise the
  // projection distance, so the simplex is pushed back inside { bottom≥0, top≤1, K>0, n>0 }.
  const loss = (praw) => {
    if (praw.some((v) => !Number.isFinite(v))) return 1e9;
    const p = clamp(praw);
    let pen = 0;
    for (let i = 0; i < praw.length; i++) { const d = praw[i] - p[i]; pen += d * d; }
    let s = 0;
    for (let i = 0; i < X.length; i++) { const r = evalModel(X[i], p) - Y[i]; s += r * r; }
    return s + 1e4 * pen;
  };
  const res = nelderMead(loss, init, { maxIter });
  const P = clamp(res.x);
  const meanY = Y.reduce((a, b) => a + b, 0) / Y.length;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < X.length; i++) {
    const yh = evalModel(X[i], P);
    ssRes += (Y[i] - yh) ** 2;
    ssTot += (Y[i] - meanY) ** 2;
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : NaN;
  return {
    bottom: P[0],
    Bmax: P[1],                                   // top (absolute plateau, ≤ 1)
    Kd: P[2],
    n: hill ? P[3] : 1,
    r2,
    model: (x) => evalModel(x, P),                                  // raw fraction bound
    shape: (x) => (hill ? shape(x, P[2], P[3]) : shape(x, P[2])),   // normalised 0→1 (specific binding)
  };
}

// Residual-bootstrap 95% CI for Kd from a SINGLE fit. Resamples the fit residuals with
// replacement onto the fitted curve, refits ~nBoot times, and takes percentiles of the Kd
// distribution. This is a within-gel *fit* uncertainty (how tightly these points pin Kd) —
// NOT replicate/run-to-run reproducibility, which is typically wider. Its most useful read
// is diagnostic: a wide interval means the titration didn't reach saturation (top/Kd trade
// off). Percentile bootstrap → asymmetric, never-negative interval, robust for small n and
// for the boundary-active `top ≤ 1` case where asymptotic SEs misbehave.
function bootstrapKd(xs, ys, opts, nBoot = 800) {
  const base = fitBinding(xs, ys, opts);
  if (!base) return null;
  const pairs = xs
    .map((x, i) => [x, ys[i]])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && x >= 0);
  const X = pairs.map((p) => p[0]);
  const Y = pairs.map((p) => p[1]);
  const n = X.length;
  if (n < 4) return null; // residual bootstrap is meaningless with too few points
  const fitted = X.map((x) => base.model(x));
  const resid = Y.map((y, i) => y - fitted[i]);
  const fastOpts = { ...opts, maxIter: 500 };

  const kds = [], ns = [], tops = [], bots = [];
  for (let b = 0; b < nBoot; b++) {
    const yb = fitted.map((f) => f + resid[(Math.random() * n) | 0]);
    const fb = fitBinding(X, yb, fastOpts);
    if (fb && Number.isFinite(fb.Kd) && fb.Kd > 0) {
      kds.push(fb.Kd); ns.push(fb.n); tops.push(fb.Bmax); bots.push(fb.bottom);
    }
  }
  if (kds.length < nBoot * 0.5) return null; // fit too unstable to trust a CI

  const pct = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    const idx = (s.length - 1) * p;
    const lo = Math.floor(idx), hi = Math.ceil(idx);
    return s[lo] + (s[hi] - s[lo]) * (idx - lo);
  };
  return {
    kd: base.Kd,
    kdLo: pct(kds, 0.025),
    kdHi: pct(kds, 0.975),
    kdMedian: pct(kds, 0.5),
    nLo: pct(ns, 0.025), nHi: pct(ns, 0.975),
    samples: kds.length,
  };
}

/* ====================================================================
   Helpers
   ==================================================================== */

const fmt = (x, d = 3) => {
  if (!Number.isFinite(x)) return "—";
  const a = Math.abs(x);
  if (a !== 0 && (a < 1e-3 || a >= 1e4)) return x.toExponential(d);
  return x.toFixed(d);
};

function SectionHead({ num, title, subtitle }) {
  return (
    <div className="section-head">
      <span className="section-num">§{num}</span>
      <h3 className="section-title">{title}</h3>
      {subtitle && <span className="section-sub">— {subtitle}</span>}
    </div>
  );
}

/* ====================================================================
   Image overlay with drag handles
   ==================================================================== */

function ImageOverlay({
  imgSrc, imgW, imgH, lanes, setLanes, laneWidth, bands, setBands, roi,
  toolMode, onCropCommit, onEmsaCommit,
  excludeRegions, onExcludeCommit,
}) {
  const wrapRef = useRef(null);
  const [drag, setDrag] = useState(null);
  const [boxW, setBoxW] = useState(800);
  // Tool-mode drawing state — separate from `drag` so it never affects the existing handlers
  const [drawing, setDrawing] = useState(null); // { x0, y0, x1, y1 }

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((es) => {
      for (const e of es) setBoxW(Math.floor(e.contentRect.width));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const scale = imgW > 0 ? boxW / imgW : 1;
  const boxH = imgH * scale;

  function clientToImg(e) {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  }

  const onDown = (kind, idx) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDrag({ kind, idx });
  };

  const onMove = (e) => {
    if (!drag) return;
    const p = clientToImg(e);
    if (drag.kind === "lane") {
      setLanes((ls) => {
        const out = ls.slice();
        out[drag.idx] = { ...out[drag.idx], x: Math.max(0, Math.min(imgW, p.x)) };
        return out;
      });
    } else if (drag.kind === "bandY") {
      setBands((b) => ({ ...b, [drag.idx]: Math.max(0, Math.min(imgH, p.y)) }));
    }
  };

  const onUp = () => setDrag(null);

  // Keep a handle drag alive even when the cursor leaves the image bounds (e.g. moving a
  // lane far up/down or a band boundary far left/right). Listeners live on window only
  // while a drag is active, and releasing anywhere ends it.
  useEffect(() => {
    if (!drag) return;
    const move = (e) => onMove(e);
    const up = () => onUp();
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
  }, [drag]);

  const onDoubleClick = (e) => {
    if (drag) return;
    const p = clientToImg(e);
    setLanes((ls) =>
      [...ls, { x: p.x, label: `L${ls.length + 1}` }]
        .sort((a, b) => a.x - b.x)
        .map((l, i) => ({ ...l, label: `L${i + 1}` }))
    );
  };

  // ----- Tool-mode drawing (crop / bg) — completely separate from handle dragging -----
  // These handlers are attached to a transparent SVG <rect> that ONLY exists when
  // toolMode is set, so they cannot interfere with band/lane handle clicks.
  const onDrawDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const p = clientToImg(e);
    setDrawing({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  };
  const onDrawMove = (e) => {
    if (!drawing) return;
    const p = clientToImg(e);
    setDrawing((d) => ({ ...d, x1: p.x, y1: p.y }));
  };
  const onDrawUp = () => {
    if (!drawing) return;
    const x = Math.round(Math.min(drawing.x0, drawing.x1));
    const y = Math.round(Math.min(drawing.y0, drawing.y1));
    const w = Math.round(Math.abs(drawing.x1 - drawing.x0));
    const h = Math.round(Math.abs(drawing.y1 - drawing.y0));
    setDrawing(null);
    if (w < 5 || h < 5) return;
    if (toolMode === 'crop') onCropCommit({ x, y, w, h });
    else if (toolMode === 'emsa') onEmsaCommit({ x, y, w, h });
    else if (toolMode === 'exclude') onExcludeCommit({ x, y, w, h });
  };

  return (
    <div
      ref={wrapRef}
      className="img-wrap"
      style={{ height: boxH }}
      onDoubleClick={onDoubleClick}
      title="Double-click empty area to add a lane"
    >
      <img src={imgSrc} alt="gel" draggable={false} className="img-base" />
      <svg
        width={boxW}
        height={boxH}
        viewBox={`0 0 ${imgW} ${imgH}`}
        className="img-svg"
      >
        <defs>
          <pattern id="exclHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="rgba(124,45,18,0.10)" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(124,45,18,0.55)" strokeWidth="1.5" />
          </pattern>
        </defs>

        {roi && (
          <rect
            x={roi.x} y={roi.y} width={roi.w} height={roi.h}
            fill="none" stroke="var(--ink)" strokeOpacity="0.25"
            strokeDasharray="6 4" strokeWidth={Math.max(1, 2 / scale)}
          />
        )}

        {bands && roi && (
          <>
            <rect
              x={roi.x} y={Math.min(bands.boundY1, bands.boundY2)}
              width={roi.w}
              height={Math.abs(bands.boundY2 - bands.boundY1)}
              fill="var(--accent)" fillOpacity="0.10"
              stroke="var(--accent)" strokeOpacity="0.55"
              strokeWidth={Math.max(1, 1.5 / scale)}
            />
            <rect
              x={roi.x} y={Math.min(bands.freeY1, bands.freeY2)}
              width={roi.w}
              height={Math.abs(bands.freeY2 - bands.freeY1)}
              fill="var(--accent-2)" fillOpacity="0.10"
              stroke="var(--accent-2)" strokeOpacity="0.55"
              strokeWidth={Math.max(1, 1.5 / scale)}
            />
            {[
              ["boundY1", "var(--accent)", "BOUND ↑"],
              ["boundY2", "var(--accent)", "BOUND ↓"],
              ["freeY1", "var(--accent-2)", "FREE ↑"],
              ["freeY2", "var(--accent-2)", "FREE ↓"],
            ].map(([key, color, label]) => (
              <g key={key}>
                <line
                  x1={roi.x} y1={bands[key]}
                  x2={roi.x + roi.w} y2={bands[key]}
                  stroke={color}
                  strokeWidth={Math.max(1, 2 / scale)}
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={onDown("bandY", key)}
                />
                <rect
                  x={roi.x + roi.w + 4 / scale}
                  y={bands[key] - 9 / scale}
                  width={84 / scale}
                  height={18 / scale}
                  fill="var(--paper)"
                  stroke={color}
                  strokeWidth={Math.max(0.5, 1 / scale)}
                  style={{ cursor: "ns-resize" }}
                  onMouseDown={onDown("bandY", key)}
                />
                <text
                  x={roi.x + roi.w + 10 / scale}
                  y={bands[key] + 4 / scale}
                  fontSize={11 / scale}
                  fill={color}
                  fontFamily="JetBrains Mono, monospace"
                  style={{ cursor: "ns-resize", userSelect: "none" }}
                  onMouseDown={onDown("bandY", key)}
                >
                  {label}
                </text>
              </g>
            ))}
          </>
        )}

        {lanes.map((l, i) => {
          const x1 = l.x - laneWidth / 2;
          const ry = roi?.y ?? 0;
          const rh = roi?.h ?? imgH;
          return (
            <g key={i}>
              <rect
                x={x1} y={ry} width={laneWidth} height={rh}
                fill="var(--ink)" fillOpacity="0.04"
                stroke="var(--ink)" strokeOpacity="0.5"
                strokeWidth={Math.max(0.5, 1 / scale)}
                pointerEvents="none"
              />
              <line
                x1={l.x} y1={ry} x2={l.x} y2={ry + rh}
                stroke="var(--ink)" strokeOpacity="0.7"
                strokeWidth={Math.max(0.5, 1.5 / scale)}
                strokeDasharray="3 3"
                pointerEvents="none"
              />
              <circle
                cx={l.x} cy={ry - 14 / scale}
                r={9 / scale}
                fill="var(--paper)"
                stroke="var(--ink)"
                strokeWidth={Math.max(0.5, 1.2 / scale)}
                style={{ cursor: "ew-resize" }}
                onMouseDown={onDown("lane", i)}
              />
              <text
                x={l.x} y={ry - 11 / scale}
                fontSize={10 / scale}
                textAnchor="middle"
                fill="var(--ink)"
                fontFamily="JetBrains Mono, monospace"
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {l.label}
              </text>
            </g>
          );
        })}

        {/* Excluded regions — imaging artefacts (bubbles, fingerprints) voided from quant.
            Always visible, never interactive. Hatched to read as "cut out". */}
        {excludeRegions && excludeRegions.length > 0 && (
          <g pointerEvents="none">
            {excludeRegions.map((r, i) => (
              <g key={i}>
                <rect
                  x={r.x} y={r.y} width={r.w} height={r.h}
                  fill="url(#exclHatch)" stroke="#7c2d12"
                  strokeWidth={Math.max(1, 1.5 / scale)} strokeDasharray="4 3"
                />
                <text x={r.x + 4} y={r.y + 13} fontSize={Math.max(9, 12 / scale)}
                      fill="#7c2d12" fontFamily="JetBrains Mono, monospace" fontWeight="600">
                  EXCL{excludeRegions.length > 1 ? ` ${i + 1}` : ''}
                </text>
              </g>
            ))}
          </g>
        )}

        {/* Tool-mode capture rect — only exists when drawing a crop or bg region.
            When toolMode is null (default), this isn't rendered, so band/lane handles work normally. */}
        {toolMode && (
          <rect
            x={0} y={0} width={imgW} height={imgH}
            fill="rgba(0,0,0,0)"
            pointerEvents="all"
            style={{ cursor: 'crosshair' }}
            onMouseDown={onDrawDown}
            onMouseMove={onDrawMove}
            onMouseUp={onDrawUp}
            onMouseLeave={onDrawUp}
          />
        )}

        {/* Live drawing preview — non-interactive */}
        {drawing && (
          <rect
            x={Math.min(drawing.x0, drawing.x1)}
            y={Math.min(drawing.y0, drawing.y1)}
            width={Math.abs(drawing.x1 - drawing.x0)}
            height={Math.abs(drawing.y1 - drawing.y0)}
            fill={toolMode === 'exclude' ? 'rgba(124,45,18,0.18)' : toolMode === 'crop' ? 'rgba(37,99,235,0.12)' : 'rgba(26,24,22,0.12)'}
            stroke={toolMode === 'exclude' ? '#7c2d12' : toolMode === 'crop' ? '#2563eb' : '#1a1816'}
            strokeWidth={Math.max(1.5, 2 / scale)}
            strokeDasharray="5 3"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
}

// Small "dots around a circle" spinner shown while the bootstrap Kd CI computes.
function CiSpinner() {
  const dots = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    dots.push(
      <circle key={i} cx={9 + 6 * Math.cos(a)} cy={9 + 6 * Math.sin(a)} r={1.4}
        fill="var(--ink)" opacity={0.15 + 0.85 * (i / 8)} />
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-label="computing">
      <g>
        {dots}
        <animateTransform attributeName="transform" type="rotate"
          from="0 9 9" to="360 9 9" dur="0.8s" repeatCount="indefinite" />
      </g>
    </svg>
  );
}

// Per-lane background QC plot: the lane's density trace (corrected), the ALS baseline fit
// under it (dashed blue), the pre-rolling-ball trace for reference (faint, when the ball is
// on), and the bound/free integration windows (shaded). Lets the user judge whether the
// smoothness/asymmetry/radius settings are sensible before trusting the numbers.
function QCPlot({ data }) {
  const { h, mean, rawMean, baseline, bound, free } = data;
  const Wp = 300, Hp = 150, pl = 6, pr = 6, pt = 8, pb = 10;
  const innerW = Wp - pl - pr, innerH = Hp - pt - pb;
  let lo = 0, hi = 1e-6;
  const scan = (arr) => { for (let i = 0; i < arr.length; i++) { if (arr[i] < lo) lo = arr[i]; if (arr[i] > hi) hi = arr[i]; } };
  scan(mean); scan(baseline); if (rawMean) scan(rawMean);
  const sx = (i) => pl + (h <= 1 ? 0 : (i / (h - 1)) * innerW);
  const sy = (val) => pt + innerH - ((val - lo) / (hi - lo)) * innerH;
  const path = (arr) => { let d = ""; for (let i = 0; i < arr.length; i++) d += (i ? "L" : "M") + sx(i).toFixed(1) + " " + sy(arr[i]).toFixed(1); return d; };
  const shade = (r, color) => r && r[1] > r[0]
    ? <rect x={sx(r[0])} y={pt} width={Math.max(0, sx(r[1]) - sx(r[0]))} height={innerH} fill={color} fillOpacity="0.12" /> : null;
  return (
    <svg viewBox={`0 0 ${Wp} ${Hp}`} style={{ width: "100%", display: "block", background: "var(--paper-3)", borderRadius: 4 }}>
      {shade(bound, "var(--accent)")}
      {shade(free, "var(--accent-2)")}
      <line x1={pl} y1={sy(0)} x2={Wp - pr} y2={sy(0)} stroke="var(--rule)" strokeWidth="0.5" />
      {rawMean && <path d={path(rawMean)} fill="none" stroke="var(--muted)" strokeWidth="0.8" opacity="0.6" />}
      <path d={path(mean)} fill="none" stroke="var(--ink)" strokeWidth="1.3" />
      <path d={path(baseline)} fill="none" stroke="#2563eb" strokeWidth="1.3" strokeDasharray="3 2" />
    </svg>
  );
}

/* ====================================================================
   Main app
   ==================================================================== */

function AnalyzerApp({ onAddToOverlay }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [origDisplaySrc, setOrigDisplaySrc] = useState(null); // 8-bit source for rotation
  const [baseSignal, setBaseSignal] = useState(null);         // high-precision signal at 0°
  const [rotation, setRotation] = useState(0);                // straighten angle, adjustable anytime
  const [loadError, setLoadError] = useState(null);
  const [signalData, setSignalData] = useState(null);
  const [roi, setRoi] = useState(null);
  const [cropRect, setCropRect] = useState(null);   // destructive crop window (straightened full-frame coords); null = full frame
  const [lanes, setLanes] = useState([]);
  const [laneWidth, setLaneWidth] = useState(50);
  const [bands, setBands] = useState(null);
  const [concs, setConcs] = useState([]);
  const [concUnit, setConcUnit] = useState("nM");
  const [fitModel, setFitModel] = useState("hill"); // 'hyperbolic' | 'hill' | 'quadratic'
  const [normFit, setNormFit] = useState(true); // display specific binding normalised 0→1 (vs raw with offset)
  const [dnaConc, setDnaConc] = useState(""); // [DNA] substrate, experiment-wide, for tight-binding
  const [toolMode, setToolMode] = useState(null);   // null | 'crop' (destructive) | 'emsa' (ROI) | 'exclude'
  const [bgSubtract, setBgSubtract] = useState(true);   // per-lane ALS background subtraction (on by default, applied to rolling-ball residual)
  const [bgLambda, setBgLambda] = useState(1e5);        // ALS smoothness/stiffness
  const [bgAsym, setBgAsym] = useState(0.01);           // ALS asymmetry (peak rejection)
  const [rbOn, setRbOn] = useState(true);               // global rolling-ball (paraboloid) subtraction (on by default)
  const [rbRadius, setRbRadius] = useState(100);        // rolling-ball radius (px), live slider value
  const [rbRadiusApplied, setRbRadiusApplied] = useState(100); // debounced radius that drives the heavy recompute
  const [qcLane, setQcLane] = useState(null);           // lane index shown in the background QC panel
  const [excludeRegions, setExcludeRegions] = useState([]);
  const [labelOffsetBound, setLabelOffsetBound] = useState(0); // px offset for bound label in export
  const fileInputRef = useRef(null);

  const onFile = async (file) => {
    if (!file) return;
    setLoadError(null);
    try {
      const { displayUrl, baseSig } = await decodeFile(file);
      setOrigDisplaySrc(displayUrl);
      setBaseSignal(baseSig);
      setRotation(0);
      setLanes([]);
      setBands(null);
      setConcs([]);
      setExcludeRegions([]);
      setQcLane(null);
      setToolMode(null);
      setCropRect(null);
      // Build the full-frame working buffer (θ=0 → identity). EMSA area defaults to the
      // auto-detected gel ROI — a sub-rectangle, NOT the whole image.
      const built = await buildWorkBuffer(baseSig, displayUrl, 0);
      setImgSrc(built.displayUrl);
      setSignalData({ sig: built.workSig, W: built.W, H: built.H });
      setRoi(
        built.workSig
          ? findGelROI(built.workSig, built.W, built.H)
          : { x: 0, y: 0, w: built.W, h: built.H }
      );
    } catch (err) {
      setLoadError(err.message || "Could not read this image.");
    }
  };

  // Rebuild the straightened working buffer from the untouched original at `deg`, optionally
  // cropped to `cr`. A sequence token guards against out-of-order async completions.
  //   resetPlacements=false → rotation fine-tune: keep EMSA area / lanes / bands / curve
  //                           (buffer dims unchanged, so placements stay valid).
  //   resetPlacements=true  → crop / reset-crop: buffer dims change, so re-default the EMSA
  //                           area and clear all placements (they were in the old coords).
  const buildSeqRef = useRef(0);
  const cleanupRef = useRef(null); // deferred-compute timer id for the async Kd CI
  const rebuildView = useCallback(async (deg, cr, { resetPlacements } = {}) => {
    if (!origDisplaySrc || !baseSignal) return;
    const seq = ++buildSeqRef.current;
    setLoadError(null);
    try {
      const built = await buildWorkBuffer(baseSignal, origDisplaySrc, deg, cr);
      if (seq !== buildSeqRef.current) return; // a newer rebuild superseded this one
      setImgSrc(built.displayUrl);
      setSignalData({ sig: built.workSig, W: built.W, H: built.H });
      if (resetPlacements) {
        setRoi(
          built.workSig
            ? findGelROI(built.workSig, built.W, built.H)
            : { x: 0, y: 0, w: built.W, h: built.H }
        );
        setLanes([]);
        setBands(null);
        setExcludeRegions([]);
        setQcLane(null);
      }
    } catch (err) {
      if (seq === buildSeqRef.current) setLoadError(err.message || "Failed to build view");
    }
  }, [origDisplaySrc, baseSignal]);

  // Fine-tune rotation at ANY time — re-straightens the current (full or cropped) window,
  // KEEPING the EMSA area, lanes, bands, and curve (buffer dimensions are unchanged).
  const applyRotation = useCallback((deg) => {
    setRotation(deg);
    rebuildView(deg, cropRect, { resetPlacements: false });
  }, [rebuildView, cropRect]);

  // ---- Destructive crop: discard everything outside the drawn window and ZOOM the view to
  // it. The rect arrives in straightened full-frame coords (the crop tool always draws on the
  // un-cropped full frame — see enterCropMode). Clamp to the original frame, store, rebuild
  // (zoom), and reset placements (coordinate system changed). ----
  const applyCropRect = useCallback((rect) => {
    if (!baseSignal) return;
    const W0 = baseSignal.W, H0 = baseSignal.H;
    const x = Math.max(0, Math.min(W0 - 1, rect.x));
    const y = Math.max(0, Math.min(H0 - 1, rect.y));
    const w = Math.min(rect.w, W0 - x);
    const h = Math.min(rect.h, H0 - y);
    if (w < 10 || h < 10) { setToolMode(null); return; }
    const cr = { x, y, w, h };
    setCropRect(cr);
    setToolMode(null);
    rebuildView(rotation, cr, { resetPlacements: true });
  }, [baseSignal, rotation, rebuildView]);

  // Restore the full frame (baseSignal is retained, so the crop is fully recoverable).
  const resetCrop = useCallback(() => {
    setCropRect(null);
    setToolMode(null);
    rebuildView(rotation, null, { resetPlacements: true });
  }, [rotation, rebuildView]);

  // Enter the crop tool. The crop rect must be drawn in full-frame coords, so if a crop is
  // already active we first restore the full frame ("briefly show the un-cropped view"),
  // then arm the draw capture. Clicking again while armed cancels.
  const enterCropMode = useCallback(() => {
    if (toolMode === 'crop') { setToolMode(null); return; }
    if (cropRect) {
      setCropRect(null);
      rebuildView(rotation, null, { resetPlacements: true });
    }
    setToolMode('crop');
  }, [toolMode, cropRect, rotation, rebuildView]);

  const autoDetectLanes = useCallback(() => {
    if (!signalData || !signalData.sig || !roi) return;
    const prof = columnProfile(signalData.sig, signalData.W, roi);
    const sm = smooth(prof, Math.max(2, Math.round(roi.w / 200)));
    const sorted = Array.from(sm).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    const prominence = Math.max(0.01, (max - med) * 0.15);
    const minDist = Math.max(8, Math.round(roi.w / 30));
    const peaks = findPeaks(sm, { minProminence: prominence, minDist });

    let lw = 40;
    if (peaks.length >= 2) {
      const dists = [];
      for (let i = 1; i < peaks.length; i++) dists.push(peaks[i].x - peaks[i - 1].x);
      dists.sort((a, b) => a - b);
      const md = dists[Math.floor(dists.length / 2)];
      lw = Math.max(10, Math.min(roi.w / 2, md * 0.7));
    } else {
      lw = Math.max(10, roi.w / 8);
    }
    setLaneWidth(Math.round(lw));
    setLanes(peaks.map((p, i) => ({ x: roi.x + p.x, label: `L${i + 1}` })));
    setConcs((prev) => peaks.map((_, i) => prev[i] ?? ""));
  }, [signalData, roi]);

  const autoDetectBands = useCallback(() => {
    if (!signalData || !signalData.sig || !roi || lanes.length === 0) return;
    const W = signalData.W;
    const sig = signalData.sig;
    const prof = new Float32Array(roi.h);
    let nCols = 0;
    for (const l of lanes) {
      const x1 = Math.max(roi.x, Math.floor(l.x - laneWidth / 2));
      const x2 = Math.min(roi.x + roi.w, Math.ceil(l.x + laneWidth / 2));
      for (let dy = 0; dy < roi.h; dy++) {
        let s = 0;
        const y = roi.y + dy;
        for (let x = x1; x < x2; x++) s += sig[y * W + x];
        prof[dy] += s;
      }
      nCols += x2 - x1;
    }
    for (let i = 0; i < prof.length; i++) prof[i] /= Math.max(1, nCols);
    const sm = smooth(prof, Math.max(2, Math.round(roi.h / 100)));
    const sorted = Array.from(sm).sort((a, b) => a - b);
    const med = sorted[Math.floor(sorted.length / 2)];
    const max = sorted[sorted.length - 1];
    const prominence = Math.max(0.005, (max - med) * 0.1);
    const minDist = Math.max(8, Math.round(roi.h / 25));
    const peaks = findPeaks(sm, { minProminence: prominence, minDist });
    if (peaks.length < 1) return;
    const sortedByProm = peaks.slice().sort((a, b) => b.prom - a.prom);
    const top = sortedByProm.slice(0, Math.min(4, sortedByProm.length));
    top.sort((a, b) => a.x - b.x);
    let bP, fP;
    if (top.length === 1) {
      fP = top[0];
      bP = { x: Math.round(roi.h * 0.1), y: 0, prom: 0 };
    } else {
      bP = top[0];
      fP = top[top.length - 1];
    }
    function halfWidth(peak) {
      const half = peak.y / 2;
      let l = peak.x;
      while (l > 0 && sm[l] > half) l--;
      let r = peak.x;
      while (r < sm.length - 1 && sm[r] > half) r++;
      return Math.max(4, Math.round((r - l) / 2));
    }
    const hwB = halfWidth(bP);
    const hwF = halfWidth(fP);
    setBands({
      boundY1: roi.y + Math.max(0, bP.x - hwB),
      boundY2: roi.y + Math.min(roi.h, bP.x + hwB),
      freeY1:  roi.y + Math.max(0, fP.x - hwF),
      freeY2:  roi.y + Math.min(roi.h, fP.x + hwF),
    });
  }, [signalData, roi, lanes, laneWidth]);

  // ---- EMSA area: a sub-rectangle of the working image defining the region of interest for
  // quantification. Drawn directly on the (full, straightened) working image, so it's in
  // working coords. Does NOT crop/zoom the view or rebuild the buffer, and does NOT alter
  // existing lanes/bands — it only constrains auto-detect. ----
  const applyEmsaArea = useCallback((rect) => {
    if (!signalData) return;
    const newRoi = {
      x: Math.max(0, rect.x),
      y: Math.max(0, rect.y),
      w: Math.min(rect.w, signalData.W - rect.x),
      h: Math.min(rect.h, signalData.H - rect.y),
    };
    setRoi(newRoi);
    setToolMode(null);
    // ROI is only an auto-detect aid; existing lanes/bands are intentionally left untouched.
  }, [signalData]);

  // ---- Background region: store rect; quant uses it for flat per-pixel subtraction ----
  // ---- Exclusion regions: artefacts (bubbles, fingerprints) voided from quant ----
  // Stored in image (signal) coordinates. Multiple allowed.
  const onExcludeCommit = useCallback((rect) => {
    setExcludeRegions((rs) => [...rs, rect]);
    setToolMode(null);
  }, []);

  const removeExclude = useCallback((i) => {
    setExcludeRegions((rs) => rs.filter((_, j) => j !== i));
  }, []);

  // Auto-detection is intentionally NOT triggered automatically (neither on upload nor
  // after crop) — the rule-based guesses are mediocre and the user generally prefers
  // to crop first and place lanes by hand. Detection now runs ONLY on button click.

  // Clear lanes/bands/concs but KEEP the gel image — for a second EMSA on the same gel.
  const resetLanes = () => {
    setLanes([]);
    setBands(null);
    setConcs([]);
    setExcludeRegions([]);
    setToolMode(null);
    setQcLane(null);
  };

  // Debounce the heavy rolling-ball recompute: the slider (rbRadius) updates instantly,
  // but the full-gel paraboloid only recomputes ~250ms after the radius stops changing.
  useEffect(() => {
    const t = setTimeout(() => setRbRadiusApplied(rbRadius), 250);
    return () => clearTimeout(t);
  }, [rbRadius]);

  // Global rolling-ball (paraboloid) background, recomputed only when the image or the
  // rolling-ball settings change — NOT on every lane/band tweak.
  const rbBackground = useMemo(() => {
    if (!rbOn || !signalData || !signalData.sig) return null;
    return rollingBallBackground(signalData.sig, signalData.W, signalData.H, rbRadiusApplied);
  }, [rbOn, rbRadiusApplied, signalData]);

  // Working signal after the optional global background subtraction. The per-lane ALS then
  // operates on THIS residual (so the two stages compose without double-counting).
  const correctedSig = useMemo(() => {
    if (!signalData || !signalData.sig) return null;
    if (!rbBackground) return signalData.sig;
    const s = signalData.sig, out = new Float32Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s[i] - rbBackground[i];
    return out;
  }, [signalData, rbBackground]);

  const quant = useMemo(() => {
    if (!signalData || !correctedSig || !bands || lanes.length === 0 || !roi) return null;
    const W = signalData.W;
    const sig = correctedSig;

    // Pixel-level exclusion test: true if (x,y) falls inside any voided artefact box.
    // Returns null (skipped entirely) when there are no exclusions, so the hot loops
    // pay nothing in the common case.
    const isExcluded = excludeRegions.length === 0
      ? null
      : (x, y) => {
          for (const r of excludeRegions) {
            if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
          }
          return false;
        };

    const lambda = bgSubtract ? bgLambda : 0;

    return lanes.map((l) => {
      const x1 = Math.max(roi.x, Math.floor(l.x - laneWidth / 2));
      const x2 = Math.min(roi.x + roi.w, Math.ceil(l.x + laneWidth / 2));

      // Per-lane vertical profile → ALS baseline running under the bands. When background
      // subtraction is off, the baseline is identically zero (raw integration).
      const { rowSum, counts, mean } = laneProfile(sig, W, roi, x1, x2, isExcluded);
      const baseline = bgSubtract
        ? alsBaseline(mean, lambda, bgAsym, 10)
        : new Float64Array(mean.length); // zeros

      const bTop = Math.min(bands.boundY1, bands.boundY2);
      const bBot = Math.max(bands.boundY1, bands.boundY2);
      const fTop = Math.min(bands.freeY1, bands.freeY2);
      const fBot = Math.max(bands.freeY1, bands.freeY2);
      const Ib = integrateBox(rowSum, counts, baseline, roi.y, bTop, bBot);
      const If = integrateBox(rowSum, counts, baseline, roi.y, fTop, fBot);

      // Keep the signed nets in the table (useful QC), but compute the fraction from the
      // non-negative parts: a negative net just means "below baseline = none here", so
      // f = bound⁺/(bound⁺+free⁺) is mathematically pinned to [0,1] by construction.
      const bNet = Ib.net;
      const fNet = If.net;
      const total = bNet + fNet;
      const bPos = Math.max(0, bNet);
      const fPos = Math.max(0, fNet);
      const denom = bPos + fPos;
      const fbound = denom > 0 ? bPos / denom : 0;
      return {
        label: l.label,
        bound: bNet,
        free: fNet,
        total,
        fbound,
      };
    });
  }, [signalData, correctedSig, bands, lanes, laneWidth, roi, excludeRegions, bgSubtract, bgLambda, bgAsym]);

  // Data for the per-lane background QC panel (the selected lane's density trace, the ALS
  // baseline fit under it, the pre-rolling-ball trace for reference, and the band windows).
  const qcData = useMemo(() => {
    if (qcLane == null || !signalData || !correctedSig || !roi || !lanes[qcLane]) return null;
    const W = signalData.W;
    const l = lanes[qcLane];
    const x1 = Math.max(roi.x, Math.floor(l.x - laneWidth / 2));
    const x2 = Math.min(roi.x + roi.w, Math.ceil(l.x + laneWidth / 2));
    const isExcluded = excludeRegions.length === 0
      ? null
      : (x, y) => {
          for (const r of excludeRegions) {
            if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return true;
          }
          return false;
        };
    const corr = laneProfile(correctedSig, W, roi, x1, x2, isExcluded);
    const baseline = bgSubtract
      ? alsBaseline(corr.mean, bgLambda, bgAsym, 10)
      : new Float64Array(corr.mean.length);
    const rawMean = rbBackground
      ? laneProfile(signalData.sig, W, roi, x1, x2, isExcluded).mean
      : null;
    const toRange = (a, b) => [
      Math.max(0, Math.round(Math.min(a, b)) - roi.y),
      Math.min(roi.h, Math.round(Math.max(a, b)) - roi.y),
    ];
    return {
      label: l.label,
      h: roi.h,
      mean: corr.mean,
      rawMean,
      baseline,
      bound: bands ? toRange(bands.boundY1, bands.boundY2) : null,
      free: bands ? toRange(bands.freeY1, bands.freeY2) : null,
    };
  }, [qcLane, signalData, correctedSig, rbBackground, roi, lanes, laneWidth, bgSubtract, bgLambda, bgAsym, excludeRegions, bands]);

  const fit = useMemo(() => {
    if (!quant) return null;
    const xs = concs.map((c) => parseFloat(c));
    const ys = quant.map((q) => q.fbound);
    if (xs.filter(Number.isFinite).length < 3) return null;
    return fitBinding(xs, ys, { model: fitModel, D: parseFloat(dnaConc) });
  }, [quant, concs, fitModel, dnaConc]);

  // 95% bootstrap CI for Kd (single-gel fit uncertainty). Computed ASYNCHRONOUSLY and
  // debounced so it never blocks typing: the curve/Kd update instantly (cheap memo above),
  // while the ~500 bootstrap refits run ~500 ms after edits stop, with a spinner. (A Web
  // Worker would be truly jank-free but blob/data-URL workers are blocked in the sandbox.)
  const [fitCI, setFitCI] = useState(null);
  const [ciStatus, setCiStatus] = useState("idle"); // 'idle' | 'computing' | 'done' | 'na'
  useEffect(() => {
    if (!quant) { setFitCI(null); setCiStatus("idle"); return; }
    const xs = concs.map((c) => parseFloat(c));
    const ys = quant.map((q) => q.fbound);
    if (xs.filter(Number.isFinite).length < 4) { setFitCI(null); setCiStatus("na"); return; }
    setCiStatus("computing");
    let cancelled = false;
    const debounce = setTimeout(() => {
      // defer one more tick so the spinner paints before the blocking compute
      const run = setTimeout(() => {
        if (cancelled) return;
        const ci = bootstrapKd(xs, ys, { model: fitModel, D: parseFloat(dnaConc) }, 500);
        if (cancelled) return;
        setFitCI(ci);
        setCiStatus(ci ? "done" : "na");
      }, 0);
      cleanupRef.current = run;
    }, 500);
    return () => { cancelled = true; clearTimeout(debounce); clearTimeout(cleanupRef.current); };
  }, [quant, concs, fitModel, dnaConc]);

  const chartPoints = useMemo(() => {
    if (!quant) return [];
    return quant.map((q, i) => ({
      x: parseFloat(concs[i]),
      y: q.fbound,
      label: q.label,
    }));
  }, [quant, concs]);

  const fitCurve = useMemo(() => {
    if (!fit) return [];
    const finiteX = chartPoints.map((d) => d.x).filter((x) => Number.isFinite(x) && x > 0);
    if (finiteX.length === 0) return [];
    const minX = Math.min(...finiteX) * 0.3;
    const maxX = Math.max(...finiteX) * 3;
    const lo = Math.log10(Math.max(1e-6, minX));
    const hi = Math.log10(Math.max(maxX, lo + 0.1));
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const x = Math.pow(10, lo + ((hi - lo) * i) / 100);
      pts.push({ x, fit: normFit ? fit.shape(x) : fit.model(x) });
    }
    return pts;
  }, [fit, chartPoints, normFit]);

  // Prism-style zero: a no-protein control can't sit on a log axis, so place it one
  // data-step left of the smallest real concentration and label that tick "0".
  // Presentation only — the fit and curve are unchanged.
  const zeroPlot = useMemo(() => {
    if (!fit) return null;
    const pos = chartPoints.filter((d) => Number.isFinite(d.x) && d.x > 0).sort((a, b) => a.x - b.x);
    const zero = chartPoints.find((d) => Number.isFinite(d.x) && d.x === 0);
    if (!zero || pos.length === 0) return null;
    const minPos = pos[0].x;
    // Place the "0" marker (no-protein control) at the concentration where the
    // displayed curve reaches 1% binding — i.e. the left edge of the meaningful
    // range. Labelled "0" but positioned so the plot doesn't waste a decade of
    // empty space on the left. Curve is monotonic, so bisect for shape/model = 0.01.
    const fn = normFit ? fit.shape : fit.model;
    const target = normFit ? 0.01 : fit.bottom + 0.01 * Math.max(1e-9, fit.Bmax - fit.bottom);
    let loX = minPos, hiX = minPos, guard = 0;
    // bracket the root: search down if minPos is already >1%, up if it's <1%
    if (fn(minPos) > target) { while (fn(loX) > target && loX > 1e-6 && guard++ < 80) loX /= 1.5; }
    else { while (fn(hiX) < target && guard++ < 80) hiX *= 1.5; }
    for (let i = 0; i < 80; i++) {
      const mid = Math.sqrt(loX * hiX);
      if (fn(mid) > target) hiX = mid; else loX = mid;
    }
    const x01 = Math.max(1e-6, Math.sqrt(loX * hiX));
    return { pseudoX: x01, y: zero.y, label: zero.label, minPos };
  }, [fit, chartPoints, normFit]);

  const mergedChart = useMemo(() => {
    const span = fit ? Math.max(1e-9, fit.Bmax - fit.bottom) : 1;
    const clamp01 = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : null);
    const yT = (y) => clamp01(normFit && fit ? (y - fit.bottom) / span : y);
    const pts = [...fitCurve.map((p) => ({ ...p, fit: clamp01(p.fit) }))];
    for (const p of chartPoints) {
      if (!Number.isFinite(p.x) || p.x <= 0) continue;
      pts.push({ x: p.x, y: yT(p.y), label: p.label });
    }
    if (zeroPlot) pts.push({ x: zeroPlot.pseudoX, y: yT(zeroPlot.y), label: zeroPlot.label });
    return pts.sort((a, b) => a.x - b.x);
  }, [fitCurve, chartPoints, fit, normFit, zeroPlot]);

  // Decade ticks across the data range; the x01 anchor is added as the "0" tick.
  const xTicks = useMemo(() => {
    const xs = chartPoints.map((p) => p.x).filter((x) => Number.isFinite(x) && x > 0);
    if (!xs.length) return undefined;
    const lo = zeroPlot ? zeroPlot.pseudoX : Math.min(...xs);
    const maxReal = Math.max(...xs);
    const ticks = [];
    for (let k = Math.ceil(Math.log10(lo)); k <= Math.ceil(Math.log10(maxReal)); k++) {
      const t = Math.pow(10, k);
      if (t > lo * 1.0001) ticks.push(t);  // keep decades clear of the "0" anchor
    }
    return zeroPlot ? [zeroPlot.pseudoX, ...ticks] : ticks;
  }, [chartPoints, zeroPlot]);

  // ---- Quant table CSV download ----
  const buildCSV = useCallback(() => {
    if (!quant) return null;
    const rows = [["lane", `[protein]_${concUnit}`, "bound", "free", "total", "fraction_bound"]];
    quant.forEach((q, i) =>
      rows.push([q.label, concs[i] ?? "", q.bound, q.free, q.total, q.fbound])
    );
    if (fit) {
      rows.push([]);
      rows.push(["# model", fitModel]);
      rows.push(["# Kd", fit.Kd, concUnit]);
      if (fitCI) {
        rows.push(["# Kd_CI95_low", fitCI.kdLo, concUnit]);
        rows.push(["# Kd_CI95_high", fitCI.kdHi, concUnit]);
        rows.push(["# Kd_CI_note", "single-gel fit bootstrap; not replicate reproducibility"]);
      }
      rows.push(["# top_Bmax", fit.Bmax]);
      rows.push(["# bottom_baseline", fit.bottom]);
      if (fitModel === "hill") rows.push(["# Hill_n", fit.n]);
      if (fitModel === "quadratic") rows.push(["# DNA_substrate", dnaConc, concUnit]);
      rows.push(["# R2", fit.r2]);
    }
    return rows
      .map((r) =>
        r
          .map((c) => {
            const s = c == null ? "" : String(c);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\n");
  }, [quant, concs, concUnit, fit, fitCI, fitModel, dnaConc]);

  // ---- CSV download (uses buildCSV) ----
  const exportCSV = useCallback(() => {
    const csv = buildCSV();
    if (!csv) return;
    // data: URL (blob: is blocked in the sandboxed iframe)
    const reader = new FileReader();
    reader.onload = (e) => {
      const a = document.createElement("a");
      a.href = e.target.result;
      a.download = "emsa-quantification.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };
    reader.readAsDataURL(new Blob([csv], { type: "text/csv" }));
  }, [buildCSV]);

  // ---- Push current result straight into the Overlay tab (no download round-trip) ----
  const [overlaySent, setOverlaySent] = useState(false);
  const addToOverlay = useCallback(() => {
    const csv = buildCSV();
    if (!csv || !onAddToOverlay) return;
    onAddToOverlay(csv);
    setOverlaySent(true);
    setTimeout(() => setOverlaySent(false), 1800);
  }, [buildCSV, onAddToOverlay]);

  // ---- Gel download ----
  const exportGelPNG = useCallback(() => {
    if (!imgSrc || !roi || lanes.length === 0) return;
    const im = new Image();
    im.onload = () => {
      const DPR = 2;
      const TOP = 52;
      const LEFT = 20;
      const RIGHT = 170;  // room for band labels on the right
      const BOTTOM = 20;

      const gelW = roi.w;
      const gelH = roi.h;
      const cw = gelW + LEFT + RIGHT;
      const ch = gelH + TOP + BOTTOM;

      const canvas = document.createElement('canvas');
      canvas.width = cw * DPR;
      canvas.height = ch * DPR;
      const ctx = canvas.getContext('2d');
      ctx.scale(DPR, DPR);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);

      // Gel image
      ctx.drawImage(im, roi.x, roi.y, gelW, gelH, LEFT, TOP, gelW, gelH);

      // 1 pt border
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(LEFT, TOP, gelW, gelH);

      // Header: "[Protein] (nM)" centred above gel
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 14px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(`[Protein] (${concUnit})`, LEFT + gelW / 2, 15);

      // Concentration values above each lane — bold
      ctx.font = 'bold 12px Helvetica, Arial, sans-serif';
      lanes.forEach((l, i) => {
        const xC = LEFT + (l.x - roi.x);
        const v = concs[i];
        ctx.fillText((v === '' || v == null) ? '—' : String(v), xC, 38);
      });

      // Band labels on the right with a short leader line, only if bands are defined
      if (bands) {
        const labelX = LEFT + gelW + 14;
        const tickX  = LEFT + gelW + 4;
        const lineEnd = LEFT + gelW;

        // Midpoints in canvas y-coords
        const bMid = TOP + ((Math.min(bands.boundY1, bands.boundY2) + Math.max(bands.boundY1, bands.boundY2)) / 2 - roi.y) + labelOffsetBound;
        const fMid = TOP + ((Math.min(bands.freeY1,  bands.freeY2)  + Math.max(bands.freeY1,  bands.freeY2))  / 2 - roi.y);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;

        // Bound label
        ctx.beginPath();
        ctx.moveTo(lineEnd, bMid);
        ctx.lineTo(tickX, bMid);
        ctx.stroke();
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('DNA–protein complex', labelX, bMid);

        // Free label
        ctx.beginPath();
        ctx.moveTo(lineEnd, fMid);
        ctx.lineTo(tickX, fMid);
        ctx.stroke();
        ctx.fillText('Free DNA', labelX, fMid);
      }

      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const a = document.createElement('a');
          a.href = e.target.result;
          a.download = 'emsa-gel.png';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        };
        reader.readAsDataURL(blob);
      }, 'image/png');
    };
    im.src = imgSrc;
  }, [imgSrc, roi, lanes, concs, concUnit, bands, labelOffsetBound]);

  // ---- Binding curve download: draw directly to canvas, no SVG conversion ----
  const exportChartPNG = useCallback(() => {
    if (!fit || chartPoints.length === 0) return;
    const DPR = 2;
    const W = 720, H = 460;
    const PAD = { top: 60, right: 36, bottom: 70, left: 80 };
    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;

    const finiteX = chartPoints.map((d) => d.x).filter((x) => Number.isFinite(x) && x > 0);
    if (finiteX.length === 0) return;
    const minReal = Math.min(...finiteX);
    const xMax = Math.max(...finiteX) * 3;
    // Zero-protein control placed at x01: the conc where the displayed curve hits 1% binding.
    const zeroCtrl = chartPoints.find((d) => Number.isFinite(d.x) && d.x === 0);
    let pseudoZeroX = null;
    if (zeroCtrl) {
      const fn = normFit ? fit.shape : fit.model;
      const target = normFit ? 0.01 : fit.bottom + 0.01 * Math.max(1e-9, fit.Bmax - fit.bottom);
      let loX = minReal, hiX = minReal, guard = 0;
      if (fn(minReal) > target) { while (fn(loX) > target && loX > 1e-6 && guard++ < 80) loX /= 1.5; }
      else { while (fn(hiX) < target && guard++ < 80) hiX *= 1.5; }
      for (let i = 0; i < 80; i++) { const mid = Math.sqrt(loX * hiX); if (fn(mid) > target) hiX = mid; else loX = mid; }
      pseudoZeroX = Math.max(1e-6, Math.sqrt(loX * hiX));
    }
    const xMin = pseudoZeroX ? pseudoZeroX : minReal * 0.3;
    let lo = Math.log10(Math.max(1e-6, xMin));
    const hi = Math.log10(Math.max(xMax, lo + 0.1));
    const xToPx = (x) => PAD.left + ((Math.log10(x) - lo) / (hi - lo)) * plotW;
    const span = Math.max(1e-9, fit.Bmax - fit.bottom);
    const yT = (y) => (normFit ? (y - fit.bottom) / span : y);
    const yMax = normFit ? 1.05 : Math.max(1.05, fit.Bmax * 1.1);
    const yToPx = (y) => PAD.top + plotH - (y / yMax) * plotH;

    const canvas = document.createElement('canvas');
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    const ctx = canvas.getContext('2d');
    ctx.scale(DPR, DPR);

    // Background — cream paper
    ctx.fillStyle = '#f9f4e9';
    ctx.fillRect(0, 0, W, H);

    // Title
    ctx.fillStyle = '#1a1816';
    ctx.font = 'bold italic 20px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Binding isotherm', PAD.left, 32);
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#4a453d';
    ctx.fillText('fraction bound vs. [protein]', PAD.left, 48);

    // Plot area background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(PAD.left, PAD.top, plotW, plotH);

    // Y-axis gridlines + ticks
    ctx.strokeStyle = 'rgba(26,24,22,0.10)';
    ctx.lineWidth = 0.5;
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#1a1816';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let y = 0; y <= 1.0; y += 0.2) {
      if (y > yMax + 0.01) break;
      const py = yToPx(y);
      ctx.strokeStyle = 'rgba(26,24,22,0.10)';
      ctx.beginPath(); ctx.moveTo(PAD.left, py); ctx.lineTo(PAD.left + plotW, py); ctx.stroke();
      // tick mark
      ctx.strokeStyle = '#1a1816';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PAD.left - 5, py); ctx.lineTo(PAD.left, py); ctx.stroke();
      ctx.lineWidth = 0.5;
      ctx.fillText(y.toFixed(1), PAD.left - 10, py);
    }

    // X-axis: label at 1×, 2×, 5× per decade to cover the full experimental range
    const logLo = Math.floor(lo);
    const logHi = Math.ceil(hi);
    const labelMultipliers = [1, 2, 5];
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    for (let k = logLo; k <= logHi; k++) {
      for (const m of labelMultipliers) {
        const xVal = m * Math.pow(10, k);
        const lv = Math.log10(xVal);
        if (lv < lo - 0.01 || lv > hi + 0.01) continue;
        if (pseudoZeroX && xVal <= pseudoZeroX * 1.0001) continue;  // "0" anchor owns the left edge
        const px = xToPx(xVal);
        if (px < PAD.left - 1 || px > PAD.left + plotW + 1) continue;

        // Vertical gridline
        ctx.strokeStyle = m === 1 ? 'rgba(26,24,22,0.14)' : 'rgba(26,24,22,0.07)';
        ctx.lineWidth = 0.5;
        ctx.beginPath(); ctx.moveTo(px, PAD.top); ctx.lineTo(px, PAD.top + plotH); ctx.stroke();

        // Tick
        ctx.strokeStyle = '#1a1816';
        ctx.lineWidth = m === 1 ? 1.25 : 0.75;
        ctx.beginPath(); ctx.moveTo(px, PAD.top + plotH); ctx.lineTo(px, PAD.top + plotH + 5); ctx.stroke();

        // Label — show 1× always; show 2× and 5× only if they won't overlap (enough space)
        const skipLabel = m !== 1 && plotW / ((logHi - logLo + 1) * 3) < 24;
        if (!skipLabel) {
          ctx.fillStyle = m === 1 ? '#1a1816' : '#4a453d';
          ctx.font = m === 1 ? 'bold 11px Helvetica, Arial, sans-serif' : '11px Helvetica, Arial, sans-serif';
          const label = xVal >= 1000 ? `${xVal / 1000}k` : xVal >= 1 ? String(xVal) : xVal.toString();
          ctx.fillText(label, px, PAD.top + plotH + 9);
        }
      }
    }

    // Plot frame
    ctx.strokeStyle = '#1a1816';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD.left, PAD.top, plotW, plotH);

    // Kd reference line (vertical)
    if (fit.Kd > 0 && Math.log10(fit.Kd) >= lo && Math.log10(fit.Kd) <= hi) {
      const kx = xToPx(fit.Kd);
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(kx, PAD.top);
      ctx.lineTo(kx, PAD.top + plotH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b91c1c';
      ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Kd = ${fmt(fit.Kd, 3)} ${concUnit}`, kx + 6, PAD.top + 6);
    }

    // half-max horizontal reference
    const halfY = yToPx(normFit ? 0.5 : fit.bottom + span / 2);
    ctx.strokeStyle = 'rgba(26,24,22,0.30)';
    ctx.lineWidth = 0.75;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(PAD.left, halfY);
    ctx.lineTo(PAD.left + plotW, halfY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Fit curve
    ctx.strokeStyle = '#1a1816';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    for (let i = 0; i <= 200; i++) {
      const x = Math.pow(10, lo + ((hi - lo) * i) / 200);
      const y = normFit ? fit.shape(x) : fit.model(x);
      const px = xToPx(x);
      const py = yToPx(y);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Data points
    ctx.fillStyle = '#b91c1c';
    ctx.strokeStyle = '#1a1816';
    ctx.lineWidth = 1;
    for (const p of chartPoints) {
      if (!Number.isFinite(p.x) || p.x <= 0) continue;
      const px = xToPx(p.x);
      const py = yToPx(yT(p.y));
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Decorative zero-protein control: "0" tick + label at the left edge, plus its data point.
    if (pseudoZeroX && zeroCtrl) {
      const zpx = xToPx(pseudoZeroX);
      // tick mark
      ctx.strokeStyle = '#1a1816';
      ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.moveTo(zpx, PAD.top + plotH); ctx.lineTo(zpx, PAD.top + plotH + 5); ctx.stroke();
      // "0" label
      ctx.fillStyle = '#1a1816';
      ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('0', zpx, PAD.top + plotH + 9);
      // zero-control data point
      ctx.fillStyle = '#b91c1c';
      ctx.strokeStyle = '#1a1816';
      ctx.lineWidth = 1;
      const zpy = yToPx(yT(zeroCtrl.y));
      ctx.beginPath();
      ctx.arc(zpx, zpy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Axis titles
    ctx.fillStyle = '#1a1816';
    ctx.font = 'bold 13px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`[Protein] (${concUnit})  ·  log scale`, PAD.left + plotW / 2, H - 18);
    ctx.save();
    ctx.translate(18, PAD.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(normFit ? 'specific binding (normalised)' : 'fraction bound', 0, 0);
    ctx.restore();

    // Stats footer
    ctx.font = 'bold 11px Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#1a1816';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    const modelLabel = fitModel === "hill" ? `Hill n = ${fmt(fit.n, 2)}`
      : fitModel === "quadratic" ? "tight-binding" : "hyperbolic";
    const stats = `Kd = ${fmt(fit.Kd, 3)} ${concUnit}  ·  top = ${fmt(fit.Bmax, 3)}  ·  bottom = ${fmt(fit.bottom, 3)}  ·  R² = ${fmt(fit.r2, 3)}  ·  ${modelLabel}`;
    ctx.fillText(stats, W - PAD.right, 32);
    if (fitCI) {
      ctx.font = '10px Helvetica, Arial, sans-serif';
      ctx.fillStyle = '#57534e';
      ctx.fillText(`Kd 95% CI [${fmt(fitCI.kdLo, 3)}, ${fmt(fitCI.kdHi, 3)}] ${concUnit} · single-gel fit`, W - PAD.right, 46);
    }

    // Download via data: URL
    canvas.toBlob((blob) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const a = document.createElement('a');
        a.href = e.target.result;
        a.download = 'emsa-binding-curve.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      };
      reader.readAsDataURL(blob);
    }, 'image/png');
  }, [fit, chartPoints, concUnit, fitModel, normFit, fitCI]);

  const reset = () => {
    setImgSrc(null);
    setOrigDisplaySrc(null);
    setBaseSignal(null);
    setRotation(0);
    setLoadError(null);
    setSignalData(null);
    setRoi(null);
    setLanes([]);
    setBands(null);
    setConcs([]);
    setExcludeRegions([]);
    setQcLane(null);
    setToolMode(null);
  };

  const removeLane = (i) => {
    setLanes((ls) =>
      ls.filter((_, j) => j !== i).map((l, k) => ({ ...l, label: `L${k + 1}` }))
    );
    setConcs((cs) => cs.filter((_, j) => j !== i));
  };

  const stepDone = {
    1: !!imgSrc,
    2: lanes.length > 0 && !!bands,
    3: concs.filter((c) => c !== "" && c != null).length >= 3,
    4: !!fit,
  };

  /* ============================================================== */

  return (
    <>
      <style>{`
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

:root {
  --paper: #f4ede0;
  --paper-2: #ebe1cb;
  --paper-3: #f9f4e9;
  --ink: #1a1816;
  --ink-2: #4a453d;
  --muted: #8a8275;
  --accent: #b91c1c;
  --accent-2: #15803d;
  --rule: rgba(26,24,22,0.18);
}

.app-root {
  background: var(--paper);
  color: var(--ink);
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 400;
  min-height: 100vh;
  position: relative;
  background-image:
    radial-gradient(circle at 20% 10%, rgba(26,24,22,0.025) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(26,24,22,0.02) 0%, transparent 60%);
}
.app-root::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  opacity:0.35; mix-blend-mode:multiply;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.09 0 0 0 0 0.08 0 0 0 0.06 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  z-index:0;
}

.container { max-width: 1180px; margin: 0 auto; padding: 40px 32px; position: relative; z-index: 1; }

/* Masthead */
.masthead { border-bottom: 2px solid var(--ink); padding-bottom: 16px; display: flex; align-items: flex-end; justify-content: space-between; }
.masthead .small-caps { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-2); margin-bottom: 4px; font-feature-settings: "smcp"; }
.masthead h1 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 64px; line-height: 0.95; margin: 0; color: var(--ink); }
.masthead h1 em { font-style: italic; }
.masthead .tag { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 24px; color: var(--ink-2); margin-top: 4px; }
.masthead .meta { text-align: right; }
.masthead .date { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-2); letter-spacing: 0.15em; }
.masthead .meta-tag { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 16px; color: var(--ink-2); margin-top: 4px; }

/* Steps */
.steps { display: flex; align-items: center; gap: 22px; margin-top: 16px; color: var(--ink-2); font-size: 14px; }
.step { display: flex; align-items: center; gap: 8px; }
.step-num { display: inline-block; width: 22px; height: 22px; line-height: 22px; border: 1px solid var(--ink); border-radius: 50%; text-align: center; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink); background: var(--paper); }
.step-num.active { background: var(--ink); color: var(--paper); }
.steps .arr { opacity: 0.4; }
.steps .spacer { flex: 1; }

/* Section */
.section { margin-bottom: 40px; }
.section-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 14px; }
.section-num { font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.2em; color: var(--ink-2); }
.section-title { font-family: 'Instrument Serif', serif; font-style: italic; font-weight: 400; font-size: 26px; color: var(--ink); margin: 0; line-height: 1; }
.section-sub { font-size: 13px; color: var(--muted); letter-spacing: 0.02em; margin-left: 4px; }

/* Buttons */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border: 1px solid var(--ink); background: var(--paper); color: var(--ink); font-size: 13px; font-family: 'IBM Plex Sans', sans-serif; cursor: pointer; transition: all 120ms ease; line-height: 1; }
.btn:hover { background: var(--ink); color: var(--paper); }
.btn-primary { background: var(--ink); color: var(--paper); }
.btn-primary:hover { background: var(--accent); border-color: var(--accent); }
.btn-ghost { border-color: transparent; }
.btn-ghost:hover { border-color: var(--ink); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn:disabled:hover { background: var(--paper); color: var(--ink); border-color: var(--ink); }
.btn-full { width: 100%; justify-content: center; }
.btn-tiny { padding: 2px 6px; }

/* Inputs */
.input { background: var(--paper-3); border: 1px solid var(--ink); padding: 5px 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink); outline: none; width: 100%; box-sizing: border-box; }
.input:focus { border-color: var(--accent); }
.select { background: var(--paper-3); border: 1px solid var(--ink); padding: 5px 8px; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--ink); outline: none; box-sizing: border-box; }

/* Drop zone */
.drop { border: 2px dashed var(--ink); padding: 60px; text-align: center; cursor: pointer; transition: all 150ms ease; background: repeating-linear-gradient(45deg, transparent, transparent 12px, rgba(26,24,22,0.03) 12px, rgba(26,24,22,0.03) 24px); }
.drop:hover { background: var(--paper-2); border-color: var(--accent); }
.drop-title { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 26px; color: var(--ink); }
.drop-sub { font-size: 13px; color: var(--ink-2); margin-top: 8px; }

/* Aside panel */
.panel { border: 1px solid var(--ink); background: var(--paper-3); padding: 16px; }
.panel-head { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border-bottom: 1px solid var(--rule); }
.small-caps { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-2); font-feature-settings: "smcp"; }
.lane-row { display: flex; align-items: center; justify-content: space-between; padding: 4px 4px; border-bottom: 1px solid var(--rule); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
.lane-row:last-child { border-bottom: 0; }
.lane-list { max-height: 180px; overflow: auto; border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule); }
.muted-text { color: var(--muted); }
.tip { font-size: 11px; color: var(--muted); margin-top: 8px; font-style: italic; line-height: 1.4; }
.pill { display: inline-flex; align-items: center; gap: 5px; padding: 2px 8px; border: 1px solid var(--ink); font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase; }
.pill-bound { color: var(--accent); border-color: var(--accent); }
.pill-free { color: var(--accent-2); border-color: var(--accent-2); }

/* Table */
table.t { width: 100%; border-collapse: collapse; }
table.t th, table.t td { padding: 6px 10px; font-family: 'JetBrains Mono', monospace; font-size: 12px; text-align: left; border-bottom: 1px solid var(--rule); }
table.t th { font-weight: 500; color: var(--ink-2); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; }

/* Stats */
.stat { border: 1px solid var(--ink); padding: 14px 16px; background: var(--paper-3); }
.stat .label { font-size: 10px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--ink-2); }
.stat .value { font-family: 'Instrument Serif', serif; font-size: 28px; line-height: 1.1; margin-top: 4px; color: var(--ink); }
.stat .value .unit { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: var(--ink-2); margin-left: 6px; }

/* Image */
.img-wrap { position: relative; width: 100%; user-select: none; border: 1px solid var(--ink); background: var(--paper-2); }
.img-base { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.img-svg { position: absolute; inset: 0; overflow: visible; }

/* Layouts */
.row-2 { display: grid; grid-template-columns: 1fr 320px; gap: 24px; }
.row-2-eq { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.cols-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.cols-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cols-3-stat { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
.conc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; }
.span-all { grid-column: 1 / -1; }
.flex-center { display: flex; align-items: center; gap: 12px; }
.flex-between { display: flex; align-items: center; justify-content: space-between; }
.flex-baseline { display: flex; align-items: baseline; justify-content: space-between; }
.mb-3 { margin-bottom: 12px; }
.mb-2 { margin-bottom: 8px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.mt-6 { margin-top: 24px; }
.gap-2 { gap: 8px; }

/* Three callouts on upload */
.callouts { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-top: 24px; }
.callout { border-left: 2px solid var(--ink); padding-left: 12px; }
.callout .num { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink-2); letter-spacing: 0.18em; }
.callout .head { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 18px; line-height: 1.2; }
.callout .body { color: var(--ink-2); font-size: 13px; margin-top: 4px; line-height: 1.4; }

.controls-stack > * + * { margin-top: 8px; }
.range { width: 100%; accent-color: var(--ink); }

.chart-card { margin-top: 24px; border: 1px solid var(--ink); background: var(--paper-3); padding: 16px; }
.chart-title { font-family: 'Instrument Serif', serif; font-style: italic; font-size: 22px; line-height: 1; }

.checkbox-label { font-family: 'JetBrains Mono', monospace; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.checkbox-label input { accent-color: var(--ink); }

footer.app-footer { margin-top: 64px; padding-top: 24px; border-top: 1px solid var(--ink); display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; color: var(--ink-2); font-family: 'JetBrains Mono', monospace; font-size: 12px; }
footer.app-footer .fin { font-family: 'Instrument Serif', serif; font-style: italic; }
footer.app-footer .footer-left { display: flex; flex-direction: column; gap: 5px; }
footer.app-footer .footer-about, footer.app-footer .footer-cite { font-size: 11px; color: var(--ink-2); opacity: 0.85; }
footer.app-footer .footer-about a { color: var(--accent); text-decoration: none; }
footer.app-footer .footer-about a:hover { text-decoration: underline; }
footer.app-footer .fin { align-self: flex-end; }

@media (max-width: 900px) {
  .row-2 { grid-template-columns: 1fr; }
  .row-2-eq { grid-template-columns: 1fr; }
  .callouts { grid-template-columns: 1fr; }
  .cols-3-stat { grid-template-columns: 1fr 1fr; }
  .masthead h1 { font-size: 44px; }
}
      `}</style>

      <div className="app-root">
        <div className="container">
          {/* Masthead */}
          <header>
            <div className="masthead">
              <div>
                <div className="small-caps">electrophoretic mobility shift assay · vol. i</div>
                <h1>Bound <em>&amp;</em> Free</h1>
                <div className="tag">a binding-curve workbench</div>
              </div>
              <div className="meta">
                <div className="date">v1.16</div>
                <div className="meta-tag">Kd by least-squares</div>
              </div>
            </div>
            <div className="steps">
              <span className="step"><span className={"step-num " + (stepDone[1] ? "active" : "")}>1</span> Upload</span>
              <ArrowRight size={14} className="arr" />
              <span className="step"><span className={"step-num " + (stepDone[2] ? "active" : "")}>2</span> Confirm regions</span>
              <ArrowRight size={14} className="arr" />
              <span className="step"><span className={"step-num " + (stepDone[3] ? "active" : "")}>3</span> Concentrations</span>
              <ArrowRight size={14} className="arr" />
              <span className="step"><span className={"step-num " + (stepDone[4] ? "active" : "")}>4</span> Fit</span>
              <span className="spacer" />
              {imgSrc && (
                <button className="btn btn-ghost" onClick={reset}>
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>
          </header>

          {/* ---------- Upload ---------- */}
          {!imgSrc && (
            <section className="section" style={{ marginTop: 32 }}>
              <SectionHead num="01" title="Provide a gel image" subtitle="JPEG, PNG, or 16-bit TIFF" />
              <div
                className="drop"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
              >
                <Upload size={28} style={{ color: "var(--ink-2)", marginBottom: 12 }} />
                <div className="drop-title">Drop your gel image here</div>
                <div className="drop-sub">JPEG · PNG — bands should appear dark on a light background</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.tif,.tiff"
                  style={{ display: "none" }}
                  onChange={(e) => onFile(e.target.files?.[0])}
                />
              </div>
              {loadError && (
                <div style={{ color: "var(--accent)", fontSize: 12, marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>
                  ⚠ {loadError}
                </div>
              )}
              <div className="callouts">
                {[
                  ["01", "We invert luminance", "so dark bands become positive signal. 16-bit TIFF is read at full depth for the cleanest faint-band quantification."],
                  ["02", "Crop, then place by hand", "rotate first if lanes are tilted, draw the crop region, then add lanes by hand (buttons or double-click). Nothing is placed for you on upload."],
                  ["03", "Per-lane background", "a smooth ALS baseline is fit under each lane and subtracted before integrating density. f bound = bound / (bound + free)."],
                ].map(([n, t, d]) => (
                  <div className="callout" key={n}>
                    <div className="num">¶{n}</div>
                    <div className="head">{t}</div>
                    <div className="body">{d}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---------- Image + region editor ---------- */}
          {imgSrc && (
            <>
              <section className="section" style={{ marginTop: 32 }}>
                <SectionHead num="02" title="Confirm the regions" subtitle="drag handles to adjust · double-click to add a lane" />
                <div className="row-2">
                  <ImageOverlay
                    imgSrc={imgSrc}
                    imgW={signalData?.W ?? 0}
                    imgH={signalData?.H ?? 0}
                    lanes={lanes}
                    setLanes={setLanes}
                    laneWidth={laneWidth}
                    bands={bands}
                    setBands={setBands}
                    roi={roi}
                    toolMode={toolMode}
                    onCropCommit={applyCropRect}
                    onEmsaCommit={applyEmsaArea}
                    excludeRegions={excludeRegions}
                    onExcludeCommit={onExcludeCommit}
                  />
                  <aside>
                    <div className="panel">
                      <div className="small-caps mb-3">orientation</div>
                      <div style={{ marginBottom: 8 }}>
                        <div className="flex-between" style={{ marginBottom: 4 }}>
                          <label className="small-caps">
                            <RotateCw size={11} style={{ verticalAlign: "-1px", marginRight: 4 }} />
                            rotate · {rotation.toFixed(1)}°
                          </label>
                          {rotation !== 0 && (
                            <button className="btn btn-ghost btn-tiny" onClick={() => applyRotation(0)} title="Reset to 0°">×</button>
                          )}
                        </div>
                        <input
                          type="range"
                          min="-15" max="15" step="0.1"
                          value={rotation}
                          disabled={!imgSrc}
                          onChange={(e) => setRotation(parseFloat(e.target.value))}
                          onPointerUp={(e) => applyRotation(parseFloat(e.target.value))}
                          onKeyUp={(e) => applyRotation(parseFloat(e.target.value))}
                          className="range"
                        />
                        <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                          straightens the image — fine-tune any time, even after placing lanes
                        </div>
                      </div>

                      <div className="small-caps mb-3" style={{ marginTop: 12 }}>tools</div>
                      <div className="controls-stack">
                        <button
                          className={`btn btn-full${toolMode === 'crop' ? ' btn-primary' : ''}`}
                          onClick={enterCropMode}
                          disabled={!imgSrc}
                          title="Drag a box to crop the image: everything outside is discarded and the view zooms to the selection (recoverable via Reset crop)"
                        >
                          <Scissors size={13} /> {toolMode === 'crop' ? 'Drawing crop…' : cropRect ? 'Re-crop image' : 'Crop image'}
                        </button>
                        {cropRect && (
                          <button className="btn btn-ghost btn-full" onClick={resetCrop} title="Restore the full uncropped frame">
                            <Maximize2 size={13} /> Reset crop (full frame)
                          </button>
                        )}
                        <button
                          className={`btn btn-full${toolMode === 'emsa' ? ' btn-primary' : ''}`}
                          onClick={() => setToolMode((t) => (t === 'emsa' ? null : 'emsa'))}
                          title="Drag a box on the gel to define the EMSA area of interest (analysis ROI — does not crop or zoom the image)"
                        >
                          <Crop size={13} /> {toolMode === 'emsa' ? 'Drawing EMSA area…' : 'Draw EMSA area'}
                        </button>
                        <button
                          className={`btn btn-full${toolMode === 'exclude' ? ' btn-primary' : ''}`}
                          onClick={() => setToolMode((t) => (t === 'exclude' ? null : 'exclude'))}
                          title="Drag a box around an imaging artefact (bubble, fingerprint) to void it from quantification"
                        >
                          <Ban size={13} /> {toolMode === 'exclude' ? 'Drawing exclusion…' : 'Draw exclusion region'}
                        </button>
                        {excludeRegions.length > 0 && (
                          <div className="lane-list" style={{ marginTop: 4 }}>
                            {excludeRegions.map((r, i) => (
                              <div className="lane-row" key={i}>
                                <span>
                                  EXCL {i + 1}{" "}
                                  <span className="muted-text">
                                    {Math.round(r.w)}×{Math.round(r.h)} @ {Math.round(r.x)},{Math.round(r.y)}
                                  </span>
                                </span>
                                <button className="btn btn-ghost btn-tiny" onClick={() => removeExclude(i)} title="Remove exclusion">
                                  <Minus size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="small-caps mb-3" style={{ marginTop: 16 }}>lane detection</div>
                      <div className="controls-stack">
                        <button className="btn btn-primary btn-full" onClick={autoDetectLanes} disabled={!signalData?.sig}>
                          <Wand2 size={13} /> Detect lanes
                        </button>
                      </div>

                      <div className="small-caps mb-3" style={{ marginTop: 16 }}>band detection</div>
                      <div className="controls-stack">
                        <button className="btn btn-primary btn-full" onClick={autoDetectBands} disabled={lanes.length === 0 || !signalData?.sig}>
                          <Wand2 size={13} /> Detect bands
                        </button>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        <label className="small-caps" style={{ display: "block", marginBottom: 4 }}>
                          lane width · {laneWidth}px
                        </label>
                        <input
                          type="range"
                          min="8"
                          max={Math.max(80, Math.round((roi?.w ?? 200) / 4))}
                          value={laneWidth}
                          onChange={(e) => setLaneWidth(parseInt(e.target.value))}
                          className="range"
                        />
                      </div>

                      <div className="small-caps mb-2" style={{ marginTop: 16 }}>
                        lanes ({lanes.length})
                      </div>
                      <div className="lane-list">
                        {lanes.map((l, i) => (
                          <div className="lane-row" key={i}>
                            <span>
                              {l.label}{" "}
                              <span className="muted-text">@ {Math.round(l.x)}</span>
                            </span>
                            <span style={{ display: "flex", gap: 2 }}>
                              <button
                                className={`btn btn-ghost btn-tiny${qcLane === i ? ' btn-primary' : ''}`}
                                onClick={() => setQcLane((q) => (q === i ? null : i))}
                                title="Show this lane's background trace + baseline"
                              >
                                <Activity size={12} />
                              </button>
                              <button className="btn btn-ghost btn-tiny" onClick={() => { if (qcLane === i) setQcLane(null); removeLane(i); }} title="Remove lane">
                                <Minus size={12} />
                              </button>
                            </span>
                          </div>
                        ))}
                        {lanes.length === 0 && (
                          <div style={{ padding: 8 }} className="muted-text">No lanes yet</div>
                        )}
                      </div>

                      <div className="tip">Tip: double-click anywhere on the image to add a lane.</div>

                      {bands && (
                        <>
                          <div className="small-caps" style={{ marginTop: 16, marginBottom: 8 }}>band regions</div>
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>
                            <div className="flex-between" style={{ marginBottom: 4 }}>
                              <span className="pill pill-bound">bound</span>
                              <span>y: {Math.round(bands.boundY1)}–{Math.round(bands.boundY2)}</span>
                            </div>
                            <div className="flex-between">
                              <span className="pill pill-free">free</span>
                              <span>y: {Math.round(bands.freeY1)}–{Math.round(bands.freeY2)}</span>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="small-caps mb-3" style={{ marginTop: 16 }}>background</div>
                      <div className="controls-stack">
                        <button
                          className={`btn btn-full${rbOn ? ' btn-primary' : ''}`}
                          onClick={() => setRbOn((v) => !v)}
                          title="Sliding-paraboloid rolling ball over the whole gel (Sternberg/ImageJ-style). Removes 2-D illumination & staining gradients before any per-lane step."
                        >
                          <Activity size={13} /> {rbOn ? 'Rolling ball (global): ON' : 'Rolling ball (global): OFF'}
                        </button>
                      </div>
                      {rbOn && (
                        <div style={{ marginTop: 8 }}>
                          <div className="flex-between" style={{ marginBottom: 4 }}>
                            <label className="small-caps">ball radius</label>
                            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {rbRadius}px
                            </span>
                          </div>
                          <input
                            type="range" min="10" max="300" step="2"
                            value={rbRadius}
                            onChange={(e) => setRbRadius(parseInt(e.target.value))}
                            className="range"
                          />
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                            larger = flatter background (keep ≳ widest band). recomputes the whole gel.
                          </div>
                        </div>
                      )}

                      <div className="controls-stack" style={{ marginTop: 10 }}>
                        <button
                          className={`btn btn-full${bgSubtract ? ' btn-primary' : ''}`}
                          onClick={() => setBgSubtract((v) => !v)}
                          title={rbOn
                            ? "Per-lane ALS baseline, fit on the rolling-ball residual (cleans up whatever the ball left)"
                            : "Fit a smooth ALS baseline under each lane's density profile and subtract it before integrating"}
                        >
                          <Activity size={13} /> {bgSubtract ? `Per-lane ALS${rbOn ? ' (on residual)' : ''}: ON` : 'Per-lane ALS: OFF'}
                        </button>
                      </div>
                      {bgSubtract && (
                        <div style={{ marginTop: 8 }}>
                          <div className="flex-between" style={{ marginBottom: 4 }}>
                            <label className="small-caps">smoothness λ</label>
                            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {bgLambda.toExponential(0)}
                            </span>
                          </div>
                          <input
                            type="range" min="2" max="8" step="0.1"
                            value={Math.log10(bgLambda)}
                            onChange={(e) => setBgLambda(Math.pow(10, parseFloat(e.target.value)))}
                            className="range"
                          />
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, marginBottom: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                            higher = straighter baseline · lower = follows local dips
                          </div>
                          <div className="flex-between" style={{ marginBottom: 4 }}>
                            <label className="small-caps">asymmetry p</label>
                            <span style={{ fontSize: 10, color: 'var(--muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                              {bgAsym.toFixed(3)}
                            </span>
                          </div>
                          <input
                            type="range" min="-3" max="-1" step="0.05"
                            value={Math.log10(bgAsym)}
                            onChange={(e) => setBgAsym(Math.pow(10, parseFloat(e.target.value)))}
                            className="range"
                          />
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, fontFamily: "'JetBrains Mono', monospace" }}>
                            lower = ignore peaks harder (baseline hugs valleys)
                          </div>
                        </div>
                      )}

                      {qcData && (
                        <div style={{ marginTop: 10, padding: 8, border: '1px solid var(--rule)', borderRadius: 4 }}>
                          <div className="flex-between" style={{ marginBottom: 6 }}>
                            <span className="small-caps">bg trace · {qcData.label}</span>
                            <button className="btn btn-ghost btn-tiny" onClick={() => setQcLane(null)} title="Close">
                              <Minus size={12} />
                            </button>
                          </div>
                          <QCPlot data={qcData} />
                          <div style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5, fontFamily: "'JetBrains Mono', monospace" }}>
                            <span style={{ color: 'var(--ink)' }}>━ density</span>{"  "}
                            <span style={{ color: '#2563eb' }}>┅ ALS baseline</span>
                            {qcData.rawMean && <>{"  "}<span style={{ color: 'var(--muted)' }}>━ pre-ball</span></>}
                            <br />
                            <span style={{ color: 'var(--accent)' }}>▮ bound</span>{"  "}
                            <span style={{ color: 'var(--accent-2)' }}>▮ free</span> windows · baseline should sit just under the trace between bands
                          </div>
                        </div>
                      )}

                      {(lanes.length > 0 || bands || excludeRegions.length > 0) && (
                        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--rule)' }}>
                          <button
                            className="btn btn-ghost btn-full"
                            onClick={resetLanes}
                            title="Clear lanes, bands and concentrations — keep the gel image"
                          >
                            <RotateCcw size={13} /> Reset lanes & bands
                          </button>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>
                            for a second EMSA on the same image
                          </div>
                        </div>
                      )}
                    </div>
                  </aside>
                </div>
              </section>

              {/* ---------- Concentrations ---------- */}
              {lanes.length > 0 && (
                <section className="section">
                  <SectionHead num="03" title="Enter protein concentrations" subtitle="the lane with [P] = 0 anchors the no-protein control" />
                  <div className="panel">
                    <div className="flex-center" style={{ marginBottom: 12 }}>
                      <span className="small-caps">unit</span>
                      <select className="select" value={concUnit} onChange={(e) => setConcUnit(e.target.value)}>
                        {["pM", "nM", "µM", "mM"].map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                      <span className="small-caps" style={{ marginLeft: 20 }}>[DNA] substrate</span>
                      <input
                        className="input"
                        style={{ width: 90 }}
                        placeholder="—"
                        value={dnaConc}
                        onChange={(e) => setDnaConc(e.target.value)}
                        title="Total probe/DNA concentration (experiment-wide). Required for the tight-binding fit; reliable Kd needs [DNA] ≤ Kd/10 for the hyperbolic model."
                      />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--muted)" }}>{concUnit}</span>
                      <div style={{ flex: 1 }} />
                    </div>
                    <div className="conc-grid">
                      {lanes.map((l, i) => (
                        <div key={i}>
                          <div className="small-caps mb-2">{l.label}</div>
                          <input
                            className="input"
                            placeholder="0"
                            value={concs[i] ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              setConcs((cs) => {
                                const out = cs.slice();
                                while (out.length < lanes.length) out.push("");
                                out[i] = v;
                                return out;
                              });
                            }}
                          />
                          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                            {concUnit}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {/* ---------- Quantification + Fit ---------- */}
              {quant && (
                <section className="section">
                  <div className="flex-baseline" style={{ marginBottom: 14 }}>
                    <SectionHead
                      num="04"
                      title="Quantification & binding fit"
                      subtitle={
                        fitModel === "hill" ? "Hill: f = b + (top−b)·[P]ⁿ/(Kdⁿ+[P]ⁿ)"
                        : fitModel === "quadratic" ? "tight-binding: b + (top−b)·θ(P,[D],Kd) — corrects ligand depletion when [DNA] ≳ Kd"
                        : "hyperbolic: f = b + (top−b)·[P]/(Kd+[P])"
                      }
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16, flexShrink: 0 }}>
                      <button
                        className="btn"
                        onClick={exportGelPNG}
                        disabled={!imgSrc || lanes.length === 0}
                        title="Download clean gel PNG"
                      >
                        <Download size={13} /> Download gel
                      </button>
                      <button
                        className="btn"
                        onClick={exportCSV}
                        disabled={!quant}
                        title="Download per-lane quantification + fit summary as CSV"
                      >
                        <FileDown size={13} /> Download CSV
                      </button>
                      <button
                        className="btn"
                        onClick={addToOverlay}
                        disabled={!quant || !fit}
                        title="Add this binding curve to the Overlay tab"
                      >
                        <Layers size={13} /> {overlaySent ? "Added ✓" : "Add to overlay"}
                      </button>
                      {bands && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--ink-2)', fontFamily: "'JetBrains Mono', monospace" }}>
                          <span>complex label</span>
                          <button className="btn btn-ghost" style={{ padding: '2px 7px', minWidth: 0 }}
                            onClick={() => setLabelOffsetBound((v) => v - 5)} title="Move label up">↑</button>
                          <button className="btn btn-ghost" style={{ padding: '2px 7px', minWidth: 0 }}
                            onClick={() => setLabelOffsetBound((v) => v + 5)} title="Move label down">↓</button>
                          {labelOffsetBound !== 0 && (
                            <button className="btn btn-ghost" style={{ padding: '2px 6px', minWidth: 0, fontSize: 10 }}
                              onClick={() => setLabelOffsetBound(0)} title="Reset offset">×</button>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="row-2-eq">
                    <div className="panel" style={{ padding: 0 }}>
                      <div className="panel-head">
                        <Beaker size={13} />
                        <span className="small-caps">per-lane density</span>
                      </div>
                      <div style={{ overflow: "auto", maxHeight: 320 }}>
                        <table className="t">
                          <thead>
                            <tr>
                              <th>lane</th>
                              <th>[P] {concUnit}</th>
                              <th>bound</th>
                              <th>free</th>
                              <th>f<sub>bound</sub></th>
                            </tr>
                          </thead>
                          <tbody>
                            {quant.map((q, i) => (
                              <tr key={i}>
                                <td>{q.label}</td>
                                <td>{concs[i] === "" || concs[i] == null ? "—" : concs[i]}</td>
                                <td style={{ color: "var(--accent)" }}>{fmt(q.bound, 2)}</td>
                                <td style={{ color: "var(--accent-2)" }}>{fmt(q.free, 2)}</td>
                                <td>{fmt(q.fbound, 3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div>
                      <div className="flex-center mb-3" style={{ gap: 8 }}>
                        <Activity size={13} />
                        <span className="small-caps">fit result</span>
                        <div style={{ flex: 1 }} />
                        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                          {[["hill", "Hill"], ["hyperbolic", "Hyperbolic"], ["quadratic", "Tight-binding"]].map(([v, lab]) => (
                            <label key={v} className="checkbox-label" title={
                              v === "quadratic" ? "Corrects for ligand depletion — needs [DNA] substrate" : ""
                            }>
                              <input
                                type="radio"
                                name="fitmodel"
                                checked={fitModel === v}
                                onChange={() => setFitModel(v)}
                              />
                              {lab}
                            </label>
                          ))}
                        </div>
                      </div>
                      {!fit && (
                        <div className="panel" style={{ fontSize: 13, color: "var(--ink-2)", fontStyle: "italic" }}>
                          {fitModel === "quadratic" && !(parseFloat(dnaConc) > 0)
                            ? "Tight-binding needs the [DNA] substrate concentration — enter it in §03 above."
                            : "Provide at least 3 lanes with numeric concentrations to fit a binding curve."}
                        </div>
                      )}
                      {fit && (
                        <div className="cols-3-stat">
                          <div className="stat">
                            <div className="label">Kd</div>
                            <div className="value">
                              {fmt(fit.Kd, 3)}<span className="unit">{concUnit}</span>
                            </div>
                          </div>
                          <div className="stat">
                            <div className="label">Kd 95% CI <span style={{ color: 'var(--muted)', fontWeight: 400 }}>· fit, single gel</span></div>
                            <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {ciStatus === "computing" && <CiSpinner />}
                              {ciStatus === "computing" && <span style={{ fontSize: 12, color: 'var(--muted)' }}>estimating…</span>}
                              {ciStatus === "done" && fitCI && (
                                <span style={{ fontSize: 15 }}>[{fmt(fitCI.kdLo, 3)}, {fmt(fitCI.kdHi, 3)}]</span>
                              )}
                              {ciStatus === "na" && <span style={{ fontSize: 12, color: 'var(--muted)' }}>≥ 4 points needed</span>}
                            </div>
                          </div>
                          <div className="stat">
                            <div className="label">Bmax (top)</div>
                            <div className="value">{fmt(fit.Bmax, 3)}{fit.Bmax >= 0.999 && <span className="unit">capped</span>}</div>
                          </div>
                          <div className="stat">
                            <div className="label">baseline</div>
                            <div className="value">{fmt(fit.bottom, 3)}</div>
                          </div>
                          {fitModel === "hill" && (
                            <div className="stat">
                              <div className="label">Hill n</div>
                              <div className="value">{fmt(fit.n, 2)}</div>
                            </div>
                          )}
                          <div className="stat span-all">
                            <div className="label">goodness of fit · R²</div>
                            <div className="value">
                              {fmt(fit.r2, 4)}
                              <span className="unit">
                                {fit.r2 > 0.95 ? "excellent" : fit.r2 > 0.85 ? "good" : "weak"}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                      {fit && (() => {
                        const maxX = Math.max(...concs.map((c) => parseFloat(c)).filter((x) => Number.isFinite(x) && x > 0), 0);
                        const wideCI = fitCI && (fitCI.kdHi - fitCI.kdLo) > fitCI.kd; // interval wider than Kd
                        const lowSat = fit.Kd > 0 && maxX > 0 && maxX < 10 * fit.Kd;
                        if (!wideCI && !lowSat) return null;
                        return (
                          <div className="panel" style={{ fontSize: 12, color: "var(--accent)", fontStyle: "italic", marginTop: 10 }}>
                            ⚠ Kd is poorly constrained{lowSat ? ` — top point (${fmt(maxX, 2)} ${concUnit}) is below ~10×Kd, so saturation isn't reached` : " — the bootstrap CI is wider than Kd itself"}. The Kd/plateau trade-off means this value is uncertain; extend the titration to higher [protein] for a reliable fit.
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {fit && (
                    <div className="chart-card">
                      <div className="flex-baseline" style={{ marginBottom: 8 }}>
                        <div>
                          <div className="chart-title">Binding isotherm</div>
                          <div className="small-caps">fraction bound vs. [protein]</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            className={`btn btn-ghost${normFit ? ' btn-primary' : ''}`}
                            onClick={() => setNormFit((v) => !v)}
                            style={{ padding: '4px 10px' }}
                            title="Normalised: plot specific binding (f − baseline)/(top − baseline), 0→1. Raw: plot f_bound with the fitted baseline offset. Kd is identical either way."
                          >
                            {normFit ? 'Normalised 0→1' : 'Raw f_bound'}
                          </button>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--ink-2)" }}>
                            n = {chartPoints.filter((d) => Number.isFinite(d.x) && d.x > 0).length} points
                          </span>
                          <button
                            className="btn btn-ghost"
                            onClick={exportChartPNG}
                            title="Download binding curve as PNG"
                            style={{ padding: '4px 10px' }}
                          >
                            <Download size={12} /> Download curve
                          </button>
                        </div>
                      </div>
                      <div style={{ width: "100%", height: 360 }}>
                        <ResponsiveContainer>
                          <ComposedChart data={mergedChart} margin={{ top: 16, right: 24, bottom: 36, left: 12 }}>
                            <CartesianGrid stroke="rgba(26,24,22,0.08)" strokeDasharray="2 4" />
                            <XAxis
                              type="number"
                              dataKey="x"
                              scale="log"
                              domain={[zeroPlot ? zeroPlot.pseudoX : "auto", "auto"]}
                              ticks={xTicks}
                              tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--ink-2)" }}
                              stroke="var(--ink)"
                              tickFormatter={(v) => {
                                if (zeroPlot && Math.abs(v - zeroPlot.pseudoX) <= zeroPlot.pseudoX * 1e-6) return "0";
                                if (v >= 1000) return `${v / 1000}k`;
                                if (v < 0.01) return v.toExponential(0);
                                return String(v);
                              }}
                              label={{
                                value: `[Protein] (${concUnit})`,
                                position: "insideBottom",
                                offset: -22,
                                style: { fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 14, fill: "var(--ink)" },
                              }}
                            />
                            <YAxis
                              domain={[0, 1]}
                              allowDataOverflow={true}
                              ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]}
                              tickFormatter={(v) => v.toFixed(1)}
                              tick={{ fontFamily: "JetBrains Mono", fontSize: 11, fill: "var(--ink-2)" }}
                              stroke="var(--ink)"
                              label={{
                                value: normFit ? "Specific binding (norm.)" : "Fraction bound",
                                angle: -90,
                                position: "insideLeft",
                                style: { fontFamily: "Instrument Serif", fontStyle: "italic", fontSize: 14, fill: "var(--ink)", textAnchor: "middle" },
                              }}
                            />
                            <Tooltip
                              contentStyle={{ background: "var(--paper)", border: "1px solid var(--ink)", fontFamily: "JetBrains Mono", fontSize: 12, color: "var(--ink)" }}
                              formatter={(v, name) => [Number.isFinite(v) ? v.toFixed(4) : v, name === "fit" ? "model" : "f bound"]}
                              labelFormatter={(v) => (zeroPlot && Math.abs(v - zeroPlot.pseudoX) <= zeroPlot.pseudoX * 1e-6) ? `[P] = 0 ${concUnit}` : `[P] = ${Number.isFinite(v) ? v.toPrecision(3) : v} ${concUnit}`}
                            />
                            <ReferenceLine
                              x={fit.Kd}
                              stroke="var(--accent)"
                              strokeDasharray="4 3"
                              label={{
                                value: `Kd = ${fmt(fit.Kd, 3)} ${concUnit}`,
                                position: "top",
                                fill: "var(--accent)",
                                fontFamily: "JetBrains Mono",
                                fontSize: 11,
                              }}
                            />
                            <ReferenceLine y={normFit ? 0.5 : fit.bottom + (fit.Bmax - fit.bottom) / 2} stroke="var(--ink-2)" strokeOpacity={0.3} strokeDasharray="2 4" />
                            <Line type="monotone" dataKey="fit" stroke="var(--ink)" strokeWidth={1.6} dot={false} isAnimationActive={false} name="fit" />
                            <Scatter
                              dataKey="y"
                              fill="var(--accent)"
                              line={false}
                              shape={(props) => {
                                const { cx, cy } = props;
                                if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null;
                                return (
                                  <circle cx={cx} cy={cy} r={5} fill="var(--paper-3)" stroke="var(--accent)" strokeWidth={2} />
                                );
                              }}
                            />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-2)", fontStyle: "italic", marginTop: 8, fontFamily: "'JetBrains Mono', monospace" }}>
                        {normFit
                          ? `Normalised specific binding (f − baseline)/(top − baseline) · baseline = ${fmt(fit.bottom, 3)}, top = ${fmt(fit.Bmax, 3)} · Kd unaffected by normalisation`
                          : `Raw fraction bound · fitted baseline = ${fmt(fit.bottom, 3)} at [P]=0 · top constrained ≤ 1`}
                        {" · "}Nelder–Mead fit · log X · zero-protein control shown at left (0), included in fit
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}

          <footer className="app-footer">
            <div className="footer-left">
              <span>BOUND &amp; FREE — a binding-curve workbench</span>
              <span className="footer-about">
                A binding-curve workbench for EMSA Kd estimation · MIT-licensed ·{" "}
                <a href="https://github.com/lucas-kuhlen/emsa-analyser" target="_blank" rel="noopener noreferrer">GitHub</a>
              </span>
              <span className="footer-cite">Cite: Kuhlen, L. (2026). Bound &amp; Free. emsa-analyzer.com</span>
            </div>
            <span className="fin">fin.</span>
          </footer>
        </div>
      </div>
    </>
  );
}

// ---- standalone mount (deploy only) ----
/* ====================================================================
   EMSA Overlay  — multi-curve binding comparison (second tab)
   Reuses the analyzer's fitBinding() above; only adds CSV ingest + plot.
   ==================================================================== */

// CSV parse: tolerant of the analyzer's commented metadata block (# Kd_CI95_*)
function parseCsv(text) {
  const lines = String(text).split(/\r?\n/);
  const rows = [];
  let header = null, kdLo = null, kdHi = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#")) {
      const c = line.replace(/^#\s*/, "").split(",");
      const key = (c[0] || "").trim().toLowerCase();
      if (key === "kd_ci95_low") kdLo = parseFloat(c[1]);
      else if (key === "kd_ci95_high") kdHi = parseFloat(c[1]);
      continue;
    }
    if (!line) continue;
    const cols = line.split(",");
    if (!header) { header = cols.map((c) => c.trim().toLowerCase()); continue; }
    const rec = {};
    header.forEach((h, i) => { rec[h] = cols[i]; });
    rows.push(rec);
  }
  if (!header) return null;
  const xKey = header.find((h) => h.includes("protein") || h.includes("conc") || h.includes("nm"));
  const yKey = header.find((h) => h.includes("fraction"));
  if (!xKey || !yKey) return null;
  const xs = [], ys = [];
  for (const r of rows) {
    const x = parseFloat(r[xKey]);
    const y = parseFloat(r[yKey]);
    if (Number.isFinite(x) && Number.isFinite(y)) { xs.push(x); ys.push(y); }
  }
  if (xs.length < 3) return null;
  return { xs, ys, kdLo: Number.isFinite(kdLo) ? kdLo : null, kdHi: Number.isFinite(kdHi) ? kdHi : null };
}

const PALETTE = ["#b91c1c", "#2b6cb0", "#15803d", "#8e44ad", "#d68910", "#16a3a3", "#7d5a3c", "#c2387a"];
const nameFromFile = (fn) => {
  const m = fn.replace(/\.csv$/i, "").match(/_([A-Za-z0-9]+)$/);
  return m ? m[1] : fn.replace(/\.csv$/i, "");
};
const fmtKd = (k) => (k >= 100 ? k.toFixed(0) : k >= 10 ? k.toFixed(1) : k.toFixed(2));
const legendLabel = (c) => {
  const ci = c.kdLo != null && c.kdHi != null ? ` (${fmtKd(c.kdLo)}\u2013${fmtKd(c.kdHi)})` : "";
  return `${c.name}  (Kd ${fmtKd(c.fit.Kd)} nM${ci})`;
};
const byKd = (arr) => [...arr].sort((a, b) => a.fit.Kd - b.fit.Kd);

const OVERLAY_CSS = `
.ov-root { max-width: 1180px; margin: 0 auto; padding: 28px 32px 80px; position: relative; z-index: 1; font-family: 'IBM Plex Sans', sans-serif; color: var(--ink); }
.ov-root .ov-h1 { font-family: 'Instrument Serif', serif; font-weight: 400; font-size: 40px; line-height: 1; margin: 0 0 4px; color: var(--ink); }
.ov-sub { color: var(--ink-2); font-size: 13px; margin: 0 0 22px; max-width: 700px; line-height: 1.5; }
.ov-panel { background: var(--paper-3); border: 1px solid var(--rule); border-radius: 10px; }
.ov-drop { padding: 26px; border: 1.5px dashed var(--rule); border-radius: 10px; text-align: center; color: var(--ink-2); font-size: 14px; cursor: pointer; transition: border-color .15s, background .15s; }
.ov-drop.hot { border-color: var(--accent); background: var(--paper-2); color: var(--accent); }
.ov-grid { display: grid; grid-template-columns: 340px 1fr; gap: 18px; margin-top: 18px; align-items: start; }
@media (max-width: 880px) { .ov-grid { grid-template-columns: 1fr; } }
.ov-crow { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--rule); }
.ov-crow:last-child { border-bottom: none; }
.ov-swatch { width: 13px; height: 13px; border-radius: 3px; flex: none; }
.ov-crow input[type=text] { border: 1px solid transparent; background: transparent; font: inherit; font-size: 13px; padding: 3px 5px; border-radius: 5px; width: 100%; color: var(--ink); }
.ov-crow input[type=text]:hover { border-color: var(--rule); }
.ov-crow input[type=text]:focus { outline: none; border-color: var(--accent); background: var(--paper); }
.ov-kd { font-size: 12px; color: var(--ink-2); white-space: nowrap; font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace; }
.ov-rm { border: none; background: none; color: var(--ink-2); cursor: pointer; font-size: 16px; line-height: 1; padding: 2px 4px; }
.ov-rm:hover { color: var(--accent); }
.ov-toolbar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 0 10px 10px; }
.ov-act { border: 1px solid var(--rule); background: var(--paper); padding: 7px 13px; border-radius: 7px; font: inherit; font-size: 13px; cursor: pointer; color: var(--ink); }
.ov-act:hover { border-color: var(--accent); color: var(--accent); }
.ov-err { color: var(--accent); font-size: 12px; padding: 6px 2px; font-family: 'JetBrains Mono', monospace; }
.ov-hd { padding: 10px 12px; font-size: 12px; font-weight: 600; color: var(--ink-2); border-bottom: 1px solid var(--rule); text-transform: uppercase; letter-spacing: .04em; }
`;

function OverlayApp({ curves, ingestFiles, rename, remove, err }) {
  const [hot, setHot] = useState(false);
  const inputRef = useRef(null);
  const chartRef = useRef(null);

  const positives = curves.flatMap((c) => c.xs.filter((x) => x > 0));
  const xmin = positives.length ? Math.min(...positives) : 1;
  const xmax = positives.length ? Math.max(...positives) : 1000;
  const lo = Math.log10(xmin * 0.6), hi = Math.log10(xmax * 1.4);
  const N = 140;
  const norm = (c, y) => {
    const span = c.fit.Bmax - c.fit.bottom;
    return span > 1e-9 ? (y - c.fit.bottom) / span : y;
  };
  const lineData = [];
  for (let i = 0; i <= N; i++) {
    const x = Math.pow(10, lo + (hi - lo) * (i / N));
    const row = { x };
    curves.forEach((c) => { row["c" + c.id] = norm(c, c.fit.model(x)); });
    lineData.push(row);
  }
  const ptData = curves.flatMap((c) =>
    c.xs.map((x, i) => (x > 0 ? { x, ["p" + c.id]: norm(c, c.ys[i]) } : null)).filter(Boolean)
  );
  const ticks = (() => {
    const t = [];
    for (let e = Math.floor(lo); e <= Math.ceil(hi); e++) {
      [1, 2, 5].forEach((m) => {
        const v = m * Math.pow(10, e);
        if (v >= Math.pow(10, lo) && v <= Math.pow(10, hi)) t.push(v);
      });
    }
    return t;
  })();

  const exportPng = () => {
    const svg = chartRef.current?.querySelector("svg");
    if (!svg) return;
    const clone = svg.cloneNode(true);
    const w = svg.clientWidth || 760, h = svg.clientHeight || 460;
    clone.setAttribute("width", w);
    clone.setAttribute("height", h);
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      const scale = 3;
      const lpad = 16, rowH = 20, sw = 13, gap = 8;
      const rows = byKd(curves).map((c) => ({ label: legendLabel(c), color: c.color }));
      const legendH = rows.length ? lpad + rows.length * rowH + 6 : 0;
      const cv = document.createElement("canvas");
      cv.width = w * scale;
      cv.height = (h + legendH) * scale;
      const ctx = cv.getContext("2d");
      ctx.fillStyle = "#f9f4e9";
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, w, h);
      ctx.textBaseline = "middle";
      ctx.font = "600 13px 'IBM Plex Sans', -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
      rows.forEach((r, i) => {
        const y = h + lpad + i * rowH;
        ctx.fillStyle = r.color;
        ctx.fillRect(lpad, y - sw / 2, sw, sw);
        ctx.fillStyle = "#1a1816";
        ctx.fillText(r.label, lpad + sw + gap, y + 1);
      });
      cv.toBlob((b) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const a = document.createElement("a");
          a.href = e.target.result;
          a.download = "emsa_overlay.png";
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        };
        reader.readAsDataURL(b);
      });
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(xml)));
  };

  return (
    <div className="ov-root">
      <style>{OVERLAY_CSS}</style>
      <h1 className="ov-h1">EMSA Overlay</h1>
      <p className="ov-sub">
        Overlay multiple EMSA titrations on one normalised axis. Each curve is Hill-fit and scaled
        between its own fitted baseline (0) and plateau (1). Use &ldquo;Add to overlay&rdquo; on the
        analysis tab, or drop exported CSVs below.
      </p>
      <div
        className={"ov-drop" + (hot ? " hot" : "")}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setHot(true); }}
        onDragLeave={() => setHot(false)}
        onDrop={(e) => { e.preventDefault(); setHot(false); ingestFiles(e.dataTransfer.files); }}
      >
        Drop EMSA quantification CSVs here, or click to choose
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          style={{ display: "none" }}
          onChange={(e) => ingestFiles(e.target.files)}
        />
      </div>
      {err && <div className="ov-err">{err}</div>}
      {curves.length > 0 && (
        <div className="ov-grid">
          <div className="ov-panel">
            <div className="ov-hd">Curves</div>
            {curves.map((c) => (
              <div className="ov-crow" key={c.id}>
                <span className="ov-swatch" style={{ background: c.color }} />
                <input type="text" value={c.name} onChange={(e) => rename(c.id, e.target.value)} />
                <span className="ov-kd">K<sub>d</sub> {fmtKd(c.fit.Kd)} nM</span>
                <button className="ov-rm" title="Remove" onClick={() => remove(c.id)}>&times;</button>
              </div>
            ))}
          </div>
          <div className="ov-panel" style={{ padding: "10px 8px 4px" }}>
            <div ref={chartRef} style={{ width: "100%", height: 460 }}>
              <ResponsiveContainer>
                <ComposedChart margin={{ top: 16, right: 24, bottom: 44, left: 8 }}>
                  <CartesianGrid stroke="var(--rule)" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="x"
                    type="number"
                    scale="log"
                    domain={[Math.pow(10, lo), Math.pow(10, hi)]}
                    ticks={ticks}
                    allowDuplicatedCategory={false}
                    tickFormatter={(v) => (v >= 1000 ? v / 1000 + "k" : String(+v.toPrecision(2)))}
                    tick={{ fontSize: 11, fill: "var(--ink-2)" }}
                    label={{ value: "[protein]  (nM)", position: "insideBottom", offset: -22, fontSize: 13, fill: "var(--ink)" }}
                  />
                  <YAxis
                    domain={[-0.05, 1.08]}
                    ticks={[0, 0.25, 0.5, 0.75, 1]}
                    tick={{ fontSize: 11, fill: "var(--ink-2)" }}
                    label={{ value: "fraction bound (normalised)", angle: -90, position: "insideLeft", offset: 14, fontSize: 13, fill: "var(--ink)", style: { textAnchor: "middle" } }}
                  />
                  <Tooltip
                    formatter={(v) => (typeof v === "number" ? v.toFixed(3) : v)}
                    labelFormatter={(v) => `[protein] ${(+v).toPrecision(3)} nM`}
                  />
                  <Legend
                    verticalAlign="top"
                    height={28}
                    payload={byKd(curves).map((c) => ({ value: legendLabel(c), type: "line", color: c.color }))}
                  />
                  {curves.map((c) => (
                    <Line key={"l" + c.id} data={lineData} dataKey={"c" + c.id} type="monotone" stroke={c.color} strokeWidth={2} dot={false} isAnimationActive={false} name={c.name} />
                  ))}
                  {curves.map((c) => (
                    <Scatter key={"s" + c.id} data={ptData} dataKey={"p" + c.id} fill={c.color} isAnimationActive={false} />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="ov-toolbar">
              <button className="ov-act" onClick={exportPng}>Export PNG</button>
              <span className="ov-kd" style={{ marginLeft: "auto" }}>
                {curves.length} curve{curves.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TABBAR_CSS = `
.emsa-shell { background: var(--paper); min-height: 100vh; }
.emsa-tabbar { max-width: 1180px; margin: 0 auto; padding: 20px 32px 0; display: flex; gap: 8px; position: relative; z-index: 2; }
.emsa-tab { font-family: 'JetBrains Mono', monospace; font-size: 12px; letter-spacing: 0.06em; text-transform: uppercase; padding: 9px 16px; border: 1px solid var(--rule); border-bottom: none; border-radius: 7px 7px 0 0; background: var(--paper-3); color: var(--ink-2); cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background .12s, color .12s; }
.emsa-tab:hover { color: var(--ink); }
.emsa-tab.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.emsa-tab .ct { font-family: 'JetBrains Mono', monospace; font-size: 10px; background: var(--accent); color: #fff; border-radius: 10px; padding: 1px 7px; line-height: 1.4; }
`;

function App() {
  const [tab, setTab] = useState("analyze");
  const [curves, setCurves] = useState([]); // {id,name,color,xs,ys,fit,kdLo,kdHi}
  const [ovErr, setOvErr] = useState("");
  const idRef = useRef(0);

  const ingestText = useCallback((text, name) => {
    const parsed = parseCsv(text);
    if (!parsed) { setOvErr(`Couldn't read ${name} — need a [protein]/conc column and a fraction_bound column.`); return false; }
    const fit = fitBinding(parsed.xs, parsed.ys, { model: "hill" });
    if (!fit) { setOvErr(`Fit failed for ${name}.`); return false; }
    setOvErr("");
    setCurves((prev) => [
      ...prev,
      { id: idRef.current++, name, color: PALETTE[prev.length % PALETTE.length], ...parsed, fit },
    ]);
    return true;
  }, []);

  const ingestFiles = useCallback((files) => {
    const arr = Array.from(files || []).filter((f) => /\.csv$/i.test(f.name));
    if (!arr.length) { setOvErr("Drop .csv files exported from the EMSA Analyzer."); return; }
    arr.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => ingestText(String(reader.result), nameFromFile(file.name));
      reader.readAsText(file);
    });
  }, [ingestText]);

  const addFromAnalyzer = useCallback((csv) => {
    ingestText(csv, "EMSA " + (idRef.current + 1));
  }, [ingestText]);

  const rename = useCallback((id, name) => setCurves((p) => p.map((c) => (c.id === id ? { ...c, name } : c))), []);
  const remove = useCallback((id) => setCurves((p) => p.filter((c) => c.id !== id)), []);

  return (
    <>
      <style>{TABBAR_CSS}</style>
      <div className="emsa-shell">
        <div className="emsa-tabbar">
          <button className={"emsa-tab" + (tab === "analyze" ? " active" : "")} onClick={() => setTab("analyze")}>
            <Beaker size={13} /> EMSA analysis
          </button>
          <button className={"emsa-tab" + (tab === "overlay" ? " active" : "")} onClick={() => setTab("overlay")}>
            <Layers size={13} /> Overlay
            {curves.length > 0 && <span className="ct">{curves.length}</span>}
          </button>
        </div>
        <div style={{ display: tab === "analyze" ? "block" : "none" }}>
          <AnalyzerApp onAddToOverlay={addFromAnalyzer} />
        </div>
        <div style={{ display: tab === "overlay" ? "block" : "none" }}>
          <OverlayApp curves={curves} ingestFiles={ingestFiles} rename={rename} remove={remove} err={ovErr} />
        </div>
      </div>
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
