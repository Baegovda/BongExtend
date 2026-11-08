// Gmail 계정과 가까이 명시된 프로필 주소만 사용해요. 메일 본문 이미지는 고르지 않아요.
globalThis.BongProfile={
 valid(value){try{const url=new URL(value);return url.protocol==='https:'&&/(^|\.)googleusercontent\.com$/i.test(url.hostname)&&/^\/(?:a|a-|ogw)\//.test(url.pathname)?url.href:null;}catch{return null;}},
 fromHtml(html,email){
  const text=String(html).slice(0,2000000).replace(/\\u003d/g,'=').replace(/\\u0026/g,'&').replace(/\\\//g,'/').replace(/&amp;/g,'&');
  const addresses=[...text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)];
  for(const photo of text.matchAll(/https:\/\/[a-z0-9.-]+googleusercontent\.com\/(?:a|a-|ogw)\/[^\s"'<>\\]+/gi)){
   const nearest=addresses.map(match=>({email:match[0].toLowerCase(),distance:Math.abs(match.index-photo.index)})).sort((a,b)=>a.distance-b.distance);
   if(nearest[0]?.email===String(email).toLowerCase()&&nearest[0].distance<500){const url=this.valid(photo[0]);if(url)return url;}
  }return null;
 }
};
