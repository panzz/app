import * as THREE from 'three';
import metaversefile from 'metaversefile';
const {useApp, useFrame, useActivate, useLoaders, usePhysics, useCleanup} = metaversefile;

const baseUrl = import.meta.url.replace(/(\/)[^\/\\]*$/, '$1');
const texBase = 'Vol_13_1';

const localVector = new THREE.Vector3();

class RampGeometry extends THREE.BoxGeometry {
  constructor(w, h, d) {
    super(w, h, d);
    
    const numPoints = this.attributes.position.array.length/3;
    for (let i = 0; i < numPoints; i++) {
      localVector.fromArray(this.attributes.position.array, i*3);
      if (localVector.z >= d/2) {
        localVector.y = -h/2;
      }
      localVector.toArray(this.attributes.position.array, i*3);
    }
    this.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 2/2, 0));
    
    const boundingBox = new THREE.Box3()
      .setFromBufferAttribute(this.attributes.position);
    const size = boundingBox.getSize(new THREE.Vector3());
    const topRight = boundingBox.max;
    
    const uvs2 = new Float32Array(numPoints*3);
    for (let i = 0; i < numPoints; i++) {
      localVector.fromArray(this.attributes.position.array, i*3);
      uvs2[i*3] = (topRight.x - localVector.x) / size.x;
      uvs2[i*3+1] = 1-(topRight.z - localVector.z) / size.z;
      uvs2[i*3+2] = localVector.y;
    }
    this.setAttribute('uv2', new THREE.BufferAttribute(uvs2, 3));
  }
}

export default () => {
  const app = useApp();
  const physics = usePhysics();
  
  const geometry = new RampGeometry(2, 2, 4);

  const map = new THREE.Texture();
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  {
    const img = new Image();
    img.onload = () => {
      map.image = img;
      map.needsUpdate = true;
    };
    img.onerror = err => {
      console.warn(err);
    };
    img.crossOrigin = 'Anonymous';
    img.src = baseUrl + texBase + '_Base_Color.png';
  }
  const normalMap = new THREE.Texture();
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  {
    const img = new Image();
    img.onload = () => {
      normalMap.image = img;
      normalMap.needsUpdate = true;
    };
    img.onerror = err => {
      console.warn(err);
    };
    img.crossOrigin = 'Anonymous';
    img.src = baseUrl + texBase + '_Normal.png';
  }
  const bumpMap = new THREE.Texture();
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  {
    const img = new Image();
    img.onload = () => {
      bumpMap.image = img;
      bumpMap.needsUpdate = true;
    };
    img.onerror = err => {
      console.warn(err);
    };
    img.crossOrigin = 'Anonymous';
    img.src = baseUrl + texBase + '_Height.png';
  }
  const baseMaterial = new THREE.MeshStandardMaterial({
    // color: 0x00b2fc,
    // specular: 0x00ffff,
    // shininess: 20,
    map,
    normalMap,
    bumpMap,
    roughness: 1,
    metalness: 0,
  });
  
  const stripeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTex: {
        type: 't',
        value: new THREE.Texture(),
        needsUpdate: true,
      },
      uTime: {
        type: 'f',
        value: 0,
        needsUpdate: true,
      },
    },
    vertexShader: `\
      ${THREE.ShaderChunk.common}
      precision highp float;
      precision highp int;

      uniform vec4 uSelectRange;

      attribute vec3 uv2;
      attribute float ao;
      attribute float skyLight;
      attribute float torchLight;

      varying vec3 vUv;
      ${THREE.ShaderChunk.logdepthbuf_pars_vertex}
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;

        vUv = uv2;

        ${THREE.ShaderChunk.logdepthbuf_vertex}
      }
    `,
    fragmentShader: `\
      precision highp float;
      precision highp int;

      #define PI 3.1415926535897932384626433832795

      uniform sampler2D uTex;
      uniform float uTime;
      uniform vec3 sunDirection;

      varying vec3 vViewPosition;
      varying vec3 vUv;
      ${THREE.ShaderChunk.logdepthbuf_pars_fragment}
      void main() {
        if (vUv.x > 0.001 && vUv.x < 0.999 && vUv.y > 0.001 && vUv.y < 0.999 && vUv.z > 0.) {
          vec4 c1 = texture(uTex, vec2(vUv.x*0.5, vUv.y + uTime));
          vec4 c2 = texture(uTex, vec2(0.5 + vUv.x*0.5, vUv.y + uTime));
          vec3 c = (c1.rgb * (1. - c2.a)) + (c2.rgb * c2.a);
          gl_FragColor = vec4(c, 1.);
        } else {
          gl_FragColor = vec4(0.);
        }
        ${THREE.ShaderChunk.logdepthbuf_fragment}
      }
    `,
    transparent: true,
    // depthWrite: false,
    // polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometry, baseMaterial);
  app.add(mesh);
  mesh.updateMatrixWorld();
  const mesh2 = new THREE.Mesh(geometry, stripeMaterial);
  app.add(mesh2);
  mesh2.updateMatrixWorld();

  (async () => {
    const img = new Image();
    await new Promise((accept, reject) => {
      img.onload = accept;
      img.onerror = reject;
      img.crossOrigin = 'Anonymous';
      img.src = baseUrl + 'stripes.png';
    });
    stripeMaterial.uniforms.uTex.value.image = img;
    stripeMaterial.uniforms.uTex.value.needsUpdate = true;
    stripeMaterial.uniforms.uTex.value.wrapS = THREE.RepeatWrapping;
    stripeMaterial.uniforms.uTex.value.wrapT = THREE.RepeatWrapping;
  })();
  
  const physicsIds = [];
  {  
    /* mesh.updateMatrixWorld();
    const physicsMesh = physics.convertMeshToPhysicsMesh(mesh);
    physicsMesh.position.copy(mesh.position);
    physicsMesh.quaternion.copy(mesh.quaternion);
    physicsMesh.scale.copy(mesh.scale); */

    // app.add(physicsMesh);
    const physicsId = physics.addGeometry(mesh);
    // app.remove(physicsMesh);
    physicsIds.push(physicsId);
  }
  
  useFrame(() => {
    stripeMaterial.uniforms.uTime.value = ((performance.now()/1000) % 3)/3;
    stripeMaterial.uniforms.uTime.needsUpdate = true;
  });
  
  useCleanup(() => {
    for (const physicsId of physicsIds) {
      physics.removeGeometry(physicsId);
    }
  });

  return app;
};