export function videoSaveTarget(info,tab={}) {
 const http=value=>{try{const url=new URL(value);return /^https?:$/.test(url.protocol)?url:null;}catch{return null;}};
 const source=http(info.srcUrl);
 if(source && /\.(mp4|webm|mov|m4v|mkv|ogv|ogg)$/i.test(source.pathname))return {mode:'direct',url:source.href};
 const page=http(info.frameUrl)||http(info.pageUrl)||http(tab.url);
 const target=page||source;
 return target?{mode:'native',url:target.href}:null;
}
