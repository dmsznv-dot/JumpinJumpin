import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createCubeCharacter,createCharacterClips} from '../cube-character.mjs';
const root=new URL('../../',import.meta.url);
const threeURL='data:text/javascript;base64,'+Buffer.from(await fs.readFile(new URL('vendor/three.module.min.js',root))).toString('base64');
const THREE=await import(threeURL);
let exporter=await fs.readFile(new URL('GLTFExporter.mjs',import.meta.url),'utf8');
exporter=exporter.replace("from 'three'",`from '${threeURL}'`);
const {GLTFExporter}=await import('data:text/javascript;base64,'+Buffer.from(exporter).toString('base64'));
globalThis.FileReader=class {
  readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onloadend?.();});}
  readAsDataURL(blob){blob.arrayBuffer().then(result=>{this.result='data:'+blob.type+';base64,'+Buffer.from(result).toString('base64');this.onloadend?.();});}
};
const rig=createCubeCharacter(THREE),animations=createCharacterClips(THREE,rig);
rig.root.remove(rig.blobShadow,rig.shieldRing);rig.resetAnimation();rig.root.updateMatrixWorld(true);
const data=await new GLTFExporter().parseAsync(rig.root,{binary:true,animations,onlyVisible:true});
const out=new URL('assets/models/cube-runner.glb',root);await fs.writeFile(out,Buffer.from(data));
console.log(JSON.stringify({path:fileURLToPath(out),bytes:data.byteLength,bones:rig.skeleton.bones.length,animations:animations.map(a=>a.name)}));
