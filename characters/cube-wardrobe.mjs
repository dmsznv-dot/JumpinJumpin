import { COSTUME_ASSETS } from './costume-manifest.mjs';

export const CUBE_COSMETICS = [
  ['none', {title:'Без украшения', icon:'🟨'}],
  ...Object.entries(COSTUME_ASSETS)
].map(([hat,item]) => ({
  id:'hat_'+hat, hat, title:item.title, icon:item.icon, full:false,
  slot:item.slot, sub:hat==='none'?'':item.slot==='back'?'Предмет на спину':'Предмет на голову', rarity:'ОБЫЧНЫЙ', unlockType:'free', cost:0
}));

const geometryByFile = new Map();
export function preloadCostume(T, type) {
  const spec = COSTUME_ASSETS[type];
  if (!spec || typeof document === 'undefined') return Promise.resolve(null);
  if (!geometryByFile.has(spec.file)) {
    const pending = import('../vendor/GLTFLoader.js').then(async ({GLTFLoader}) => {
      const url = new URL('../'+spec.file, import.meta.url);
      const gltf = await new GLTFLoader().loadAsync(url.href);
      const mesh = gltf.scene.getObjectByProperty('isMesh', true);
      if (!mesh) throw new Error('Empty headwear model: '+spec.file);
      mesh.material.dispose();
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      return mesh.geometry;
    }).catch(error => { geometryByFile.delete(spec.file); throw error; });
    geometryByFile.set(spec.file, pending);
  }
  return geometryByFile.get(spec.file);
}

export function createCubeAccessories(T, type='none') {
  const group = new T.Group();
  group.name = 'CubeAccessory_'+type;
  let disposed = false;
  let material;
  if (COSTUME_ASSETS[type]) preloadCostume(T,type).then(geometry => {
    if (!geometry || disposed) return;
    material = new T.MeshStandardMaterial({vertexColors:true,roughness:.62});
    group.add(new T.Mesh(geometry,material));
  }).catch(error => console.warn('[headwear]',type,error));
  return {group,full:false,printMaterials:[],dispose(){disposed=true;material?.dispose();}};
}
