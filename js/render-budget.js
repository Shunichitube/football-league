// A scaled QHD viewport must not allocate a Retina-sized QHD drawing buffer.
export function mobileRendering(doc=globalThis.document){
 return !!doc?.documentElement?.classList?.contains('mobile-layout');
}
export function renderPixelRatio(width,height,dpr=globalThis.devicePixelRatio||1,mobile=mobileRendering()){
 const ratio=Math.min(Math.max(Number(dpr)||1,.1),2);
 return mobile?Math.min(ratio,1280/Math.max(1,width,height)):ratio;
}
