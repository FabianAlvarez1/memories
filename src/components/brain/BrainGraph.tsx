// =========================================================
// BRAIN GRAPH — 3D Force-Directed Neuron Visualization
// Ultra-Realistic Biological Neural Network + Three.js
// =========================================================

import { useRef, useCallback, useMemo, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { useMemoryStore } from '@/store/useMemoryStore';
import type { MemoryNode, MemoryLink } from '@/types/memory';

interface GraphData {
  nodes: MemoryNode[];
  links: MemoryLink[];
}

let glowTexture: THREE.Texture | null = null;
function getGlowTexture() {
  if (glowTexture) return glowTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.2)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(canvas);
  return glowTexture;
}

const nucleusUniforms = { time: { value: 0 } };
let sharedNucleusMaterial: THREE.ShaderMaterial | null = null;

function getNucleusMaterial() {
  if (sharedNucleusMaterial) return sharedNucleusMaterial;
  sharedNucleusMaterial = new THREE.ShaderMaterial({
    uniforms: nucleusUniforms,
    vertexShader: `
      varying vec3 vPosition;
      varying vec3 vWorldPosition;
      void main() {
        vPosition = position;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float time;
      varying vec3 vPosition;
      varying vec3 vWorldPosition;

      void main() {
        float pat1 = sin(vPosition.x * 0.5 + time * 3.0) * 0.5 + 0.5;
        float pat2 = sin(vPosition.y * 0.6 - time * 2.5) * 0.5 + 0.5;
        float pat3 = sin(vPosition.z * 0.4 + time * 2.0) * 0.5 + 0.5;
        
        vec3 purple = vec3(0.6, 0.0, 1.0);
        vec3 yellow = vec3(1.0, 1.0, 0.0);
        vec3 cyan = vec3(0.0, 0.8, 1.0);
        vec3 orange = vec3(1.0, 0.5, 0.0);

        vec3 color1 = mix(purple, yellow, pat1);
        vec3 color2 = mix(cyan, orange, pat2);
        vec3 finalColor = mix(color1, color2, pat3);
        
        float offset = vWorldPosition.x * 0.1 + vWorldPosition.y * 0.1;
        float blink = pow(sin(time * 4.0 + offset), 6.0);
        float alpha = 0.4 + blink * 0.6;
        
        gl_FragColor = vec4(finalColor + vec3(blink * 0.8), alpha);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false
  });
  return sharedNucleusMaterial;
}

function taperTubeGeometry(tubeGeo: THREE.TubeGeometry, curve: THREE.CatmullRomCurve3, tubularSegments: number, radialSegments: number) {
  const pos = tubeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const segment = Math.floor(i / (radialSegments + 1));
    const t = segment / tubularSegments;
    const taper = Math.pow(1.0 - t, 1.5); 
    const center = curve.getPointAt(t);
    pos.setXYZ(
      i, 
      center.x + (pos.getX(i) - center.x) * taper, 
      center.y + (pos.getY(i) - center.y) * taper, 
      center.z + (pos.getZ(i) - center.z) * taper
    );
  }
  tubeGeo.computeVertexNormals();
}

function taperLinkGeometry(tubeGeo: THREE.TubeGeometry, curve: THREE.CatmullRomCurve3, tubularSegments: number, radialSegments: number) {
  const pos = tubeGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const segment = Math.floor(i / (radialSegments + 1));
    const t = segment / tubularSegments; 
    // Estrechamiento biológico: grueso en las puntas (1.0), más fino en el centro (0.35)
    const thickness = 0.35 + 0.65 * Math.pow(Math.abs(t - 0.5) * 2.0, 2.0); 
    const center = curve.getPointAt(t);
    pos.setXYZ(
      i, 
      center.x + (pos.getX(i) - center.x) * thickness, 
      center.y + (pos.getY(i) - center.y) * thickness, 
      center.z + (pos.getZ(i) - center.z) * thickness
    );
  }
  tubeGeo.computeVertexNormals();
}

export default function BrainGraph() {
  const graphRef = useRef<any>(null);
  const linkObjectsRef = useRef(new Set<any>());
  const { brainGraph, selectMemory, viewDate } = useMemoryStore();

  const graphData = useMemo<GraphData>(() => {
    const vd = new Date(viewDate);
    const windowStart = new Date(vd);
    windowStart.setDate(windowStart.getDate() - 5);

    // Filter nodes within the 5-day window
    const filteredNodes = brainGraph.nodes
      .filter(n => {
        const d = new Date(n.created_at);
        return d >= windowStart && d <= vd;
      })
      .map(n => {
        const d = new Date(n.created_at);
        const daysDiff = (vd.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        // Recent (0 days) → fz=0 (front), Oldest (5 days) → fz=-500 (deep)
        const fz = -daysDiff * 100;
        return { ...n, fz };
      });

    // Only include links between visible nodes
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = brainGraph.links
      .filter(l => nodeIds.has(l.source as string) && nodeIds.has(l.target as string))
      .map(l => ({ ...l, source: l.source, target: l.target }));

    return { nodes: filteredNodes, links: filteredLinks };
  }, [brainGraph, viewDate]);

  const mouseRef = useRef(new THREE.Vector2(-9999, -9999));
  const mouseWorldRef = useRef(new THREE.Vector3(-9999, -9999, -9999));

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseRef.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  // Environment Setup
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;

    try {
      const scene = graph.scene();
      
      if (!scene.getObjectByName('ambientLight')) {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        ambientLight.name = 'ambientLight';
        scene.add(ambientLight);
      }
      
      // Eliminar el polvo viejo para que los cambios se reflejen en vivo (HMR)
      const oldDust = scene.getObjectByName('neuralDust');
      if (oldDust) {
        scene.remove(oldDust);
      }

      const createDustLayer = (count: number, size: number, spread: number, opacity: number) => {
        const posArray = new Float32Array(count * 3);
        const colorArray = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const i3 = i * 3;
          posArray[i3] = (Math.random() - 0.5) * spread;
          posArray[i3+1] = (Math.random() - 0.5) * spread;
          posArray[i3+2] = (Math.random() - 0.5) * spread;
          const color = new THREE.Color();
          // Hacer los colores un poco más saturados y brillantes
          color.setHSL(Math.random(), 0.9, 0.5 + Math.random() * 0.5);
          colorArray[i3] = color.r;
          colorArray[i3+1] = color.g;
          colorArray[i3+2] = color.b;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3));
        
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            time: { value: 0 },
            mouseWorld: { value: new THREE.Vector3(0,0,0) },
            tex: { value: getGlowTexture() },
            baseSize: { value: size },
            opacity: { value: opacity }
          },
          vertexShader: `
            uniform float time;
            uniform vec3 mouseWorld;
            uniform float baseSize;
            attribute vec3 color;
            varying vec3 vColor;
            
            void main() {
              vColor = color;
              vec3 pos = position;
              
              // Movimiento orgánico incrementado (1.5x)
              pos.x += sin(time * 3.0 + pos.y * 0.01) * 20.0;
              pos.y += cos(time * 3.5 + pos.z * 0.01) * 20.0;
              pos.z += sin(time * 2.2 + pos.x * 0.01) * 20.0;
              
              // Fuerza repulsiva del mouse
              vec4 worldPos = modelMatrix * vec4(pos, 1.0);
              float dist = distance(worldPos.xyz, mouseWorld);
              float repRadius = 400.0; // Radio de repulsión
              if (dist < repRadius) {
                vec3 dir = normalize(worldPos.xyz - mouseWorld);
                float force = pow((repRadius - dist) / repRadius, 2.0);
                worldPos.xyz += dir * force * 300.0; // Fuerte repulsión
              }
              
              vec4 mvPosition = viewMatrix * worldPos;
              // Size attenuation equivalente al de PointsMaterial
              gl_PointSize = baseSize * (800.0 / -mvPosition.z);
              gl_Position = projectionMatrix * mvPosition;
            }
          `,
          fragmentShader: `
            uniform sampler2D tex;
            uniform float opacity;
            varying vec3 vColor;
            void main() {
              vec4 texColor = texture2D(tex, gl_PointCoord);
              gl_FragColor = vec4(vColor * texColor.rgb, texColor.a * opacity);
            }
          `,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false
        });
        return new THREE.Points(geo, mat);
      };
      
      const dustGroup = new THREE.Group();
      dustGroup.name = 'neuralDust';
      
      // Densidad extrema: Redujimos la dispersión (spread) a 4000 para concentrarlas
      // y aumentamos masivamente el tamaño (size) de 3/6/14 a 15/30/60
      dustGroup.add(createDustLayer(20000, 6, 3000, 0.2));
      dustGroup.add(createDustLayer(10000, 12, 3000, 0.2));
      dustGroup.add(createDustLayer(4000,  15, 3000, 0.2));
      
      scene.add(dustGroup);
    } catch(err) {
      console.error('Error setting up brain environment:', err);
    }
  }, [graphData]);

  // Ultra-Realistic Biological Procedural Neuron Generator
  const nodeThreeObject = useCallback((node: any) => {
    const container = new THREE.Group();
    const group = new THREE.Group();
    container.add(group);
    const size = (node.size ?? 1) * 5; // Larger scale for intricate details
    
    // Derived Colors based on the reference image style
    const primaryColor = new THREE.Color(node.color ?? '#00d4bf');
    const accentColor = new THREE.Color('#ff7700').lerp(primaryColor, 0.15); // Golden/Orange fire core
    const corePurple = new THREE.Color('#9900ff');

    // 1. Core Nucleus (Intense glowing energy center with moving mixed colors)
    const nucGeo = new THREE.SphereGeometry(size * 0.35, 32, 32);
    const nucMat = getNucleusMaterial();
    const nucleus = new THREE.Mesh(nucGeo, nucMat);
    group.add(nucleus);

    // 1.5 Brilliant Orange Inner Core
    const orangeCoreGeo = new THREE.SphereGeometry(size * 0.2, 32, 32);
    const orangeCoreMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ff6600').multiplyScalar(2.5),
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    const orangeCore = new THREE.Mesh(orangeCoreGeo, orangeCoreMat);
    group.add(orangeCore);

    // 2. Soma (Cell Membrane) - Smooth biological transparent layer
    const somaGeo = new THREE.SphereGeometry(size, 64, 64);
    const pos = somaGeo.attributes.position;
    const v = new THREE.Vector3();
    for(let i=0; i<pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      // Smooth 3D noise distortion (no spikes)
      const noise = 1 + (Math.sin(v.x * 0.15) * Math.cos(v.y * 0.15) * Math.sin(v.z * 0.15)) * 0.15;
      v.multiplyScalar(noise);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    somaGeo.computeVertexNormals();
    
    const somaMat = new THREE.MeshPhongMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.15, // Extremely transparent so we can see the core!
      depthWrite: false, // Critical to avoid hiding internal objects
      shininess: 100,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide
    });
    const soma = new THREE.Mesh(somaGeo, somaMat);
    group.add(soma);

    // 3. Sprawling Dendrites & Axons (The complex neural web)
    const curves: THREE.CatmullRomCurve3[] = [];
    const numMainBranches = 12 + Math.floor(Math.random() * 8); // Heavy branching
    
    const branchMatInner = new THREE.MeshBasicMaterial({
      color: accentColor,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.8
    });
    const branchMatOuter = new THREE.MeshPhysicalMaterial({
      color: primaryColor,
      transmission: 0.9,
      transparent: true,
      opacity: 0.5,
      roughness: 0.3
    });

    for(let i=0; i<numMainBranches; i++) {
      // Directions spread radially
      const startDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      ).normalize();
      
      const points = [];
      let cur = startDir.clone().multiplyScalar(size * 0.6); // Start slightly inside the membrane
      points.push(cur.clone());
      
      const length = size * (3 + Math.random() * 6); // Extremely long tentacles
      const steps = 8;
      
      for(let j=0; j<steps; j++) {
        const wander = new THREE.Vector3((Math.random()-0.5)*1.8, (Math.random()-0.5)*1.8, (Math.random()-0.5)*1.8);
        const stepVec = startDir.clone().add(wander).normalize().multiplyScalar(length / steps);
        cur.add(stepVec);
        points.push(cur.clone());

        // Generate Sub-branches organically
        if (Math.random() > 0.4 && j > 1 && j < steps - 1) {
           const subPoints = [cur.clone()];
           let subCur = cur.clone();
           const subDir = stepVec.clone().applyAxisAngle(new THREE.Vector3(Math.random(), Math.random(), Math.random()).normalize(), Math.PI/2.2).normalize();
           for(let k=0; k<4; k++) {
              const subWander = new THREE.Vector3((Math.random()-0.5), (Math.random()-0.5), (Math.random()-0.5));
              subCur.add(subDir.clone().add(subWander).normalize().multiplyScalar((length/steps)*0.8));
              subPoints.push(subCur.clone());
           }
           const subCurve = new THREE.CatmullRomCurve3(subPoints);
           curves.push(subCurve);
           
           const subTubeGeo = new THREE.TubeGeometry(subCurve, 12, size * 0.05, 5, false);
           taperTubeGeometry(subTubeGeo, subCurve, 12, 5);
           group.add(new THREE.Mesh(subTubeGeo, branchMatOuter));
           const subTubeInnerGeo = new THREE.TubeGeometry(subCurve, 12, size * 0.02, 4, false);
           taperTubeGeometry(subTubeInnerGeo, subCurve, 12, 4);
           group.add(new THREE.Mesh(subTubeInnerGeo, branchMatInner));
        }
      }
      
      const curve = new THREE.CatmullRomCurve3(points);
      curves.push(curve);
      
      // Main branch tubes
      const tubeGeo = new THREE.TubeGeometry(curve, 24, size * 0.12, 6, false);
      taperTubeGeometry(tubeGeo, curve, 24, 6);
      group.add(new THREE.Mesh(tubeGeo, branchMatOuter));
      
      const innerTubeGeo = new THREE.TubeGeometry(curve, 24, size * 0.05, 5, false);
      taperTubeGeometry(innerTubeGeo, curve, 24, 5);
      group.add(new THREE.Mesh(innerTubeGeo, branchMatInner));
    }

    // 4. Bioluminescent Auras (Plasma glow)
    const tex = getGlowTexture();
    const auraOuter = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: primaryColor, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.35, depthWrite: false
    }));
    auraOuter.scale.set(size * 18, size * 18, 1);
    group.add(auraOuter);

    const auraInner = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, color: accentColor, blending: THREE.AdditiveBlending, transparent: true, opacity: 0.7, depthWrite: false
    }));
    auraInner.scale.set(size * 7, size * 7, 1);
    group.add(auraInner);

    // 5. Energy Transport System (Glowing sparks traveling the dendrites)
    const numParticles = Math.max(1, Math.floor(curves.length * 0.37)); // Reducido a la mitad nuevamente
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(numParticles * 3);
    const particleSizes = new Float32Array(numParticles);
    
    const sizeMultipliers = [1.0, 1.5, 2.0];

    for(let i=0; i<numParticles; i++) {
      particleSizes[i] = sizeMultipliers[Math.floor(Math.random() * sizeMultipliers.length)];
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute('sizeMultiplier', new THREE.BufferAttribute(particleSizes, 1));
    
    const particleMat = new THREE.ShaderMaterial({
      uniforms: {
        tex: { value: tex },
        baseSize: { value: size * 0.6 }
      },
      vertexShader: `
        uniform float baseSize;
        attribute float sizeMultiplier;
        void main() {
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = (baseSize * sizeMultiplier * 500.0) / -mvPosition.z;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D tex;
        void main() {
          vec4 texColor = texture2D(tex, gl_PointCoord);
          gl_FragColor = vec4(1.0, 1.0, 1.0, texColor.a);
        }
      `,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false
    });
    
    const particles = new THREE.Points(particleGeo, particleMat);
    group.add(particles);

    const particleData: any[] = [];
    for(let i=0; i<numParticles; i++) {
      const curve = curves[i % curves.length];
      particleData.push({
        curve,
        t: Math.random(),
        speed: 0.002 + Math.random() * 0.004 // Variable speeds
      });
    }

    // Prepare data for the animation loop
    node.__animData = {
      innerGroup: group,
      soma, nucleus, orangeCore, particles, particleData,
      offset: Math.random() * Math.PI * 2,
      rotationSpeed: new THREE.Vector3((Math.random()-0.5)*0.003, (Math.random()-0.5)*0.003, (Math.random()-0.5)*0.003),
      floatTime: Math.random() * 100,
      floatSpeed: new THREE.Vector3(0.5 + Math.random(), 0.5 + Math.random(), 0.5 + Math.random()).multiplyScalar(0.01)
    };
    node.__threeObj = container;

    return container;
  }, []);

  const linkThreeObject = useCallback((link: any) => {
    const group = new THREE.Group();
    
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    
    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShaderOuter = `
      uniform vec3 sourceColor;
      uniform vec3 targetColor;
      varying vec2 vUv;
      void main() {
        vec3 gradient = mix(sourceColor, targetColor, vUv.x);
        gl_FragColor = vec4(gradient, 0.25);
      }
    `;

    const fragmentShaderInner = `
      uniform vec3 sourceColor;
      uniform vec3 targetColor;
      uniform float time;
      varying vec2 vUv;
      
      float random(vec2 st) {
          return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
      }
      
      void main() {
        vec3 gradient = mix(sourceColor, targetColor, vUv.x);
        
        float speed = time * 2.0;
        float wave1 = sin(vUv.x * 20.0 - speed * 3.0);
        float wave2 = sin(vUv.x * 40.0 - speed * 4.5);
        float chaos = random(vec2(floor(vUv.x * 10.0 - speed * 2.0), 0.0));
        
        float burst = max(0.0, wave1 * wave2) * chaos;
        burst = pow(burst, 2.0) * 8.0; 
        
        vec3 finalColor = gradient * 1.5 + vec3(1.0) * burst;
        
        // Centro 100% opaco
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;

    const branchMatOuter = new THREE.ShaderMaterial({
      uniforms: {
        sourceColor: { value: new THREE.Color('#ffffff') },
        targetColor: { value: new THREE.Color('#ffffff') }
      },
      vertexShader,
      fragmentShader: fragmentShaderOuter,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const branchMatInner = new THREE.ShaderMaterial({
      uniforms: {
        sourceColor: { value: new THREE.Color('#ffffff') },
        targetColor: { value: new THREE.Color('#ffffff') },
        time: { value: 0.0 }
      },
      vertexShader,
      fragmentShader: fragmentShaderInner,
      transparent: false,
      depthWrite: true
    });
    
    const outerMesh = new THREE.Mesh(new THREE.BufferGeometry(), branchMatOuter);
    const innerMesh = new THREE.Mesh(new THREE.BufferGeometry(), branchMatInner);
    group.add(outerMesh);
    group.add(innerMesh);
    
    group.__curve = curve;
    group.__outerMesh = outerMesh;
    group.__innerMesh = innerMesh;
    
    // Guardar referencia para actualizarlo en el loop permanente
    linkObjectsRef.current.add({ link, group });
    
    return group;
  }, []);

  const linkPositionUpdate = useCallback((sprite: any, { start, end }: any, link: any) => {
    // Al devolver true, le decimos a force-graph que NO mueva nuestro contenedor.
    // Nosotros manejaremos la forma y posición desde nuestro bucle infinito de renderizado.
    sprite.position.set(0, 0, 0);
    sprite.rotation.set(0, 0, 0);
    sprite.scale.set(1, 1, 1);
    return true; 
  }, []);

  // The Heartbeat & Energy Flow Animation
  const handleVisualTick = useCallback(() => {
    const time = Date.now() * 0.001;
    nucleusUniforms.time.value = time;
    
    graphData.nodes.forEach((node: any) => {
      const obj = node.__threeObj;
      const data = node.__animData;
      if (obj && data && data.innerGroup) {
        // Organic Breathing Effect
        const scale = 1 + Math.sin(time * 2.5 + data.offset) * 0.04;
        data.soma.scale.set(scale, scale, scale);
        data.nucleus.scale.set(scale * 1.1, scale * 1.1, scale * 1.1);
        if (data.orangeCore) {
          data.orangeCore.scale.set(scale * 1.15, scale * 1.15, scale * 1.15);
        }

        // Slow cinematic rotation of the entire biological structure
        data.innerGroup.rotation.x += data.rotationSpeed.x;
        data.innerGroup.rotation.y += data.rotationSpeed.y;
        data.innerGroup.rotation.z += data.rotationSpeed.z;

        // Subtle random movement
        data.floatTime += 1;
        data.innerGroup.position.x = Math.sin(data.floatTime * data.floatSpeed.x + data.offset) * 8;
        data.innerGroup.position.y = Math.cos(data.floatTime * data.floatSpeed.y + data.offset) * 8;
        data.innerGroup.position.z = Math.sin(data.floatTime * data.floatSpeed.z + data.offset) * 8;

        // Continuous and random electricity animation in dendrites
        const positions = data.particles.geometry.attributes.position.array;
        for(let i=0; i<data.particleData.length; i++) {
          const p = data.particleData[i];
          p.t += p.speed;
          if (p.t > 1) {
            p.t = 0; // Loop particle back to soma
            p.speed = 0.002 + Math.random() * 0.006;
          }
          
          const point = p.curve.getPointAt(p.t);
          const jitter = 0.3; // Menos agresiva
          positions[i*3] = point.x + (Math.random() - 0.5) * jitter;
          positions[i*3+1] = point.y + (Math.random() - 0.5) * jitter;
          positions[i*3+2] = point.z + (Math.random() - 0.5) * jitter;
        }
        data.particles.geometry.attributes.position.needsUpdate = true;
      }
    });

    // Animar la conexión permanentemente (incluso cuando la física se detiene)
    linkObjectsRef.current.forEach((item: any) => {
      const { link, group } = item;
      if (!group || !group.parent) return; // Esperar a que esté en la escena

      // Resolver nodos desde la data actual (para asegurar coordenadas actualizadas)
      const sNode = typeof link.source === 'object' ? link.source : graphData.nodes.find((n: any) => n.id === link.source);
      const tNode = typeof link.target === 'object' ? link.target : graphData.nodes.find((n: any) => n.id === link.target);

      if (!sNode || !tNode || sNode.x === undefined || tNode.x === undefined) return;

      const sPos = new THREE.Vector3(sNode.x, sNode.y, sNode.z);
      const tPos = new THREE.Vector3(tNode.x, tNode.y, tNode.z);

      const sData = sNode.__animData;
      const tData = tNode.__animData;

      if (sData && sData.innerGroup) sPos.add(sData.innerGroup.position);
      if (tData && tData.innerGroup) tPos.add(tData.innerGroup.position);

      const dist = sPos.distanceTo(tPos);
      if (dist < 1.0) return;

      group.__curve.points[0].copy(sPos);
      group.__curve.points[3].copy(tPos);

      const p1 = sPos.clone().lerp(tPos, 0.33);
      const p2 = sPos.clone().lerp(tPos, 0.66);

      const droop = dist * 0.1;
      p1.y -= droop;
      p2.y -= droop;

      const wiggle1 = Math.sin(time * 0.5 + sPos.x) * dist * 0.05;
      const wiggle2 = Math.cos(time * 0.5 + tPos.z) * dist * 0.05;

      p1.x += wiggle1; p1.z += wiggle2;
      p2.x -= wiggle2; p2.z += wiggle1; 

      group.__curve.points[1].copy(p1);
      group.__curve.points[2].copy(p2);

      if (group.__outerMesh.geometry) group.__outerMesh.geometry.dispose();
      if (group.__innerMesh.geometry) group.__innerMesh.geometry.dispose();

      const size = (sNode.size || 1) * 5;

      const outerGeo = new THREE.TubeGeometry(group.__curve, 20, size * 0.45, 8, false);
      taperLinkGeometry(outerGeo, group.__curve, 20, 8);

      const innerGeo = new THREE.TubeGeometry(group.__curve, 20, size * 0.15, 6, false);
      taperLinkGeometry(innerGeo, group.__curve, 20, 6);

      group.__outerMesh.geometry = outerGeo;
      group.__innerMesh.geometry = innerGeo;

      // Update shader uniforms for color gradient and energy bursts
      const outerMat = group.__outerMesh.material as THREE.ShaderMaterial;
      const innerMat = group.__innerMesh.material as THREE.ShaderMaterial;
      
      const sColor = new THREE.Color(sNode.color ?? '#00d4bf');
      const tColor = new THREE.Color(tNode.color ?? '#00d4bf');
      
      if (outerMat.uniforms) {
        outerMat.uniforms.sourceColor.value.copy(sColor);
        outerMat.uniforms.targetColor.value.copy(tColor);
      }
      if (innerMat.uniforms) {
        innerMat.uniforms.sourceColor.value.copy(sColor);
        innerMat.uniforms.targetColor.value.copy(tColor);
        innerMat.uniforms.time.value = time;
      }
    });

    if (graphRef.current) {
      const scene = graphRef.current.scene();
      const camera = graphRef.current.camera();
      
      // Proyectar el mouse al plano 3D (Z=0) para la repulsión
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouseRef.current, camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(plane, target);
      if (target) {
        mouseWorldRef.current.copy(target);
      }

      const dust = scene.getObjectByName('neuralDust');
      if (dust) {
        // Rotación general incrementada (1.5x)
        dust.rotation.y = time * 0.015;
        dust.rotation.x = time * 0.0075;
        
        // Actualizar uniforms de los Shaders de partículas
        dust.children.forEach((layer: any) => {
          if (layer.material.uniforms) {
            layer.material.uniforms.time.value = time;
            layer.material.uniforms.mouseWorld.value.copy(mouseWorldRef.current);
          }
        });
      }
    }
  }, [graphData.nodes]);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      handleVisualTick();
      frameId = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frameId);
  }, [handleVisualTick]);

  const handleNodeClick = useCallback((node: MemoryNode) => {
    selectMemory(node.id);

    if (graphRef.current) {
      const distance = 100; // Increased distance to appreciate scale
      const distRatio = 1 + distance / Math.hypot(node.x ?? 0, node.y ?? 0, node.z ?? 0);
      graphRef.current.cameraPosition(
        { x: (node.x ?? 0) * distRatio, y: (node.y ?? 0) * distRatio, z: (node.z ?? 0) * distRatio },
        { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 },
        1500
      );
    }
  }, [selectMemory]);

  return (
    <ForceGraph3D
      ref={graphRef}
      graphData={graphData as any}
      backgroundColor="#000000"
      nodeThreeObject={nodeThreeObject as any}
      nodeThreeObjectExtend={false}
      linkThreeObject={linkThreeObject as any}
      linkPositionUpdate={linkPositionUpdate as any}
      linkWidth={0} // Línea original invisible
      linkOpacity={0}
      onNodeClick={handleNodeClick as any}
      warmupTicks={100}
      cooldownTicks={50}
      nodeLabel={(node: MemoryNode) => {
        const title = node.title || 'Sin título';
        const date = new Date(node.created_at).toLocaleDateString('es', {
          day: '2-digit', month: '2-digit', year: 'numeric'
        });
        return `<div style="text-align: center; font-family: sans-serif; line-height: 1.4;">
          <strong style="color: #fff; font-size: 14px;">${title}</strong><br/>
          <span style="font-size: 12px; color: #aaa;">${date}</span>
        </div>`;
      }}
      enableNodeDrag
      enableNavigationControls
      showNavInfo={false}
      d3VelocityDecay={0.3}
    />
  );
}
