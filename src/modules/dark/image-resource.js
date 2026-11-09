// No domain exceptions or new grants: both actual page and image origins must already be allowed.
export function darkImageOrigins(pageUrl,resourceUrl){
 try{
  const page=new URL(pageUrl),resource=new URL(resourceUrl);
  const publicHost=host=>host.includes('.')&&!/^\d+\./.test(host)&&!host.includes(':')&&!/(^|\.)(localhost|local|internal|test|invalid)$/.test(host);
  if([page,resource].some(url=>url.protocol!=='https:'||url.username||url.password||url.port||!publicHost(url.hostname)))return null;
  return [...new Set([page.origin+'/*',resource.origin+'/*'])];
 }catch{return null;}
}
export async function fetchDarkImage(url,{fetchImpl=fetch,signal}={}){
 const response=await fetchImpl(url,{credentials:'omit',redirect:'error',cache:'force-cache',signal});
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!response.ok||!['image/png','image/webp','image/svg+xml'].includes(type)||Number(response.headers.get('content-length'))>131072)throw Error('unsupported image');
 const reader=response.body?.getReader();if(!reader)throw Error('missing image');
 const chunks=[];let size=0;
 try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>131072)throw Error('image too large');chunks.push(value);}}
 catch(error){await reader.cancel().catch(()=>{});throw error;}
 finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
 let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {type,data:btoa(binary)};
}
