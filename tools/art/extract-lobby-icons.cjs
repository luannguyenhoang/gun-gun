// Extract the supplied atlas into transparent 4096px masters and small UI PNGs.
// Run with NODE_PATH pointing to the bundled runtime's node_modules.
const sharp = require('sharp');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '../../assets/ui/lobby');
const regions = [
 ['friends-button',32,25,208,95],['profile-frame',258,11,114,122],['settings-button',390,25,89,95],
 ['heart',638,24,96,92],['diamond',770,26,98,88],['coin',899,22,98,98],
 ['character',48,146,58,66],['hourglass',158,150,47,60],['skull-blue',261,144,92,94],['zombie-blue',368,144,91,94],
 ['avatar-ring',490,135,110,109],['avatar-character',612,135,112,110],
 ['check-brown',749,145,74,73],['star-purple',835,145,73,73],['question-blue',921,145,75,73],
 ['trophy',42,241,72,76],['trophy-alt',147,241,71,76],['skull-purple',264,248,91,95],['zombie-purple',369,249,89,94],
 ['avatar-ring-alt',490,248,110,109],['avatar-character-alt',612,248,112,109],
 ['check-orange',748,222,75,73],['star-cream',835,222,73,73],['question-purple',921,222,75,74],
 ['gear',40,350,75,75],['check-green',749,299,74,73],['star-magenta',835,299,73,73],['question-sky',921,299,75,73],
 ['warning',261,387,81,79],['info',362,386,79,80],['chat-alert',457,380,89,84],['lock-orange',561,386,66,79],['star-brown',648,387,78,79],
 ['play-button',742,379,255,94],['gear-alt',40,468,75,76],['hourglass-button',136,466,83,90],
 ['chat-brown',263,478,77,76],['chat-star',362,475,79,79],['lock-beige',464,475,67,80],
 ['star-gold',555,476,78,79],['star-gold-alt',648,476,78,79],
 ['arrow-up-button',744,472,81,84],['arrow-down-button',829,472,82,84],['sort-button',916,472,81,84]
];
async function saveIcon(name, buffer) {
 const cropped = await sharp(buffer).trim({threshold:8}).png().toBuffer();
 await sharp(cropped).resize(4096,4096,{fit:'contain',background:'#00000000',kernel:'lanczos3'}).png().toFile(path.join(root,'4k',name+'.png'));
 await sharp(cropped).resize(512,512,{fit:'inside',kernel:'lanczos3'}).png({palette:true,colours:256,dither:0,compressionLevel:9}).toFile(path.join(root,'runtime',name+'.png'));
}
(async()=>{
 const source = process.argv[2] || path.join(root,'transparent-sheet.png');
 const meta = await sharp(source).metadata();
 const sx=meta.width/1024, sy=meta.height/572;
 for(const [name,x,y,w,h] of regions) {
  const buffer=await sharp(source).extract({left:Math.round(x*sx),top:Math.round(y*sy),width:Math.round(w*sx),height:Math.round(h*sy)}).png().toBuffer();
  await saveIcon(name,buffer);
 }
 // Isolate the cream messaging glyph from its purple button, retaining its silhouette.
 const {data,info}=await sharp(source).extract({left:Math.round(53*sx),top:Math.round(45*sy),width:Math.round(49*sx),height:Math.round(46*sy)}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=0;i<data.length;i+=4) {
  const cream=Math.min(data[i],data[i+1],data[i+2]);
  data[i+3]=Math.round(data[i+3]*Math.max(0,Math.min(1,(cream-140)/55)));
 }
 await saveIcon('friends-chat',await sharp(data,{raw:info}).png().toBuffer());
 // This reference contains no weapon; retain the established pistol silhouette.
 await saveIcon('weapon',Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="512" height="512"><g fill="#4b2d25"><path fill-rule="evenodd" d="M3 4h20v6h-8l-2 5H9l-1 6H2L4 10H2V6h1zm7 6-1 3h3l1-3z"/><path d="M5 3h3v2H5zm13 0h2v2h-2z"/></g></svg>'));
 await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({masterSize:[4096,4096],runtimeMaxEdge:512,note:'Upscaled extractions from a 1024x572 reference; not native 4K detail.',icons:[...regions.map(r=>({name:r[0],sourceRect:r.slice(1)})),{name:'friends-chat'},{name:'weapon',source:'existing lobby SVG'}]},null,2)+'\n');
 console.log('Exported '+(regions.length+2)+' icons.');
})().catch(e=>{console.error(e);process.exitCode=1;});
