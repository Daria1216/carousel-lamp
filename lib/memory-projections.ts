import * as THREE from 'three';

const scatter = (n: number) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Layered optical light only: sharp glints, colored halos, dust and airy bokeh. */
export function createMemoryProjections(scene: THREE.Scene, pixelRatio: number) {
  const group = new THREE.Group();
  group.name = 'night-prismatic-stars';
  scene.add(group);
  const hues = ['#ffbc69', '#73acff', '#f57ed3', '#b19aff', '#65e3dd'];
  const layers: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>[] = [];

  function layer(count: number, kind: number, sizeMin: number, sizeMax: number) {
    const positions: number[] = [], colors: number[] = [], phases: number[] = [], sizes: number[] = [];
    for (let i = 0; i < count; i++) {
      const seed = i + kind * 1000;
      const angle = scatter(seed + 300) * Math.PI * 2;
      const radius = 1.8 + scatter(seed + 600) * 2.15 + Math.sin(angle * 3) * 0.22;
      const height = kind === 3 ? 0.55 + scatter(seed + 41) * 6.2
        : kind === 2 ? 0.04 + scatter(seed + 42) * 0.2 : 0.025;
      // Airborne glints stay mainly outside the object's silhouette.
      const r = kind === 3 ? 2.35 + scatter(seed + 55) * 0.8 : radius;
      positions.push(Math.sin(angle) * r, height, Math.cos(angle) * r);
      const color = new THREE.Color(hues[i % hues.length]);
      colors.push(color.r, color.g, color.b);
      phases.push(scatter(seed + 22) * Math.PI * 2);
      sizes.push(sizeMin + scatter(seed + 90) ** 2 * (sizeMax - sizeMin));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('phase', new THREE.Float32BufferAttribute(phases, 1));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: {
        strength: { value: 0 }, time: { value: 0 },
        pixelRatio: { value: pixelRatio }, kind: { value: kind },
      },
      transparent: true, toneMapped: false, depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute vec3 color; attribute float phase; attribute float size;
        uniform float time; uniform float pixelRatio; uniform float kind;
        varying vec3 tint; varying float pulse;
        void main(){
          tint=color;
          pulse=(.35+.65*pow(.5+.5*sin(time*(.35+.12*sin(phase))+phase),2.0))*(.55+.45*fract(phase));
          vec3 local=position;
          if(kind>2.5){local.x+=sin(time*.18+phase)*.07;local.y+=sin(time*.24+phase)*.08;}
          vec4 p=modelViewMatrix*vec4(local,1.0);
          gl_Position=projectionMatrix*p;
          gl_PointSize=clamp(size*pixelRatio*12.0/max(1.0,-p.z),1.0,96.0*pixelRatio);
        }`,
      fragmentShader: `
        uniform float strength; uniform float kind;
        varying vec3 tint; varying float pulse;
        void main(){
          vec2 p=(gl_PointCoord-.5)*2.0;
          float r2=dot(p,p);
          float edge=1.0-smoothstep(.72,1.0,length(p));
          float core=exp(-r2*110.0);
          float halo=exp(-r2*5.5)*.22;
          float rays=exp(-abs(p.x)*65.0-abs(p.y)*5.0)+exp(-abs(p.y)*65.0-abs(p.x)*5.0);
          float shape;
          if(kind<.5){shape=exp(-r2*8.0);}
          else if(kind>1.5 && kind<2.5){shape=exp(-r2*3.8)*.2;core=0.0;}
          else{shape=core+halo+rays*.45;}
          vec3 light=tint*1.55+vec3(1.0,.88,.74)*core*.75;
          gl_FragColor=vec4(light,clamp(shape*edge*strength*pulse,0.0,1.0));
          #include <colorspace_fragment>
        }`,
    });
    const points = new THREE.Points(geometry, material);
    points.name = ['ground-fine-sparkles', 'ground-luminous-glints', 'soft-colored-bokeh', 'airborne-glints'][kind];
    group.add(points);
    layers.push(points);
  }
  layer(560, 0, 1.5, 4.5);
  layer(48, 1, 14, 30);
  layer(42, 2, 20, 48);
  layer(26, 3, 10, 23);

  return {
    update(night: number, time: number, reduced: boolean, wind = 0, rotation = 0) {
      group.visible = night > 0.01;
      const level = THREE.MathUtils.smoothstep(night, 0.15, 0.9);
      group.rotation.y = reduced ? 0 : Math.sin(time * 0.4) * wind * 0.015 + Math.sin(rotation) * 0.018;
      layers.forEach((points, i) => {
        points.material.uniforms.strength.value = level * [0.9, 1.4, 0.8, 0.95][i];
        points.material.uniforms.time.value = reduced ? 0 : time;
      });
    },
    dispose() {
      scene.remove(group);
      layers.forEach((points) => { points.geometry.dispose(); points.material.dispose(); });
    },
  };
}
