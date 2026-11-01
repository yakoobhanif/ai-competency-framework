import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function LightField({
  paused,
  framed = false,
}: {
  paused: boolean;
  framed?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    pause = useRef(paused);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    pause.current = paused;
  }, [paused]);
  useEffect(() => {
    const el = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
    renderer.setClearColor(framed ? 0x101114 : 0x0b0b0d, 1);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 18);
    const sculpture = new THREE.Group();
    scene.add(sculpture);
    const objects: { geometry: THREE.BufferGeometry; material: THREE.LineBasicMaterial }[] = [];
    for (let strand = 0; strand < 230; strand++) {
      const lane = strand / 229,
        vertices: number[] = [],
        colors: number[] = [];
      for (let j = 0; j < 210; j++) {
        const t = j / 209,
          x = (t - 0.5) * 18 + 4.5;
        const envelope = Math.sin(t * Math.PI);
        const y = 1.8 * Math.sin(t * 6.8 + lane * 1.9) + (lane - 0.5) * 4.5 * envelope;
        const z = 1.7 * Math.cos(t * 6.1 + lane * 3.6) * envelope;
        vertices.push(x, y, z);
        const hue = (0.49 + lane * 0.76 + t * 0.16) % 1;
        const color = new THREE.Color().setHSL(hue, 0.95, 0.52 + 0.1 * Math.sin(t * Math.PI));
        colors.push(color.r, color.g, color.b);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.45 + (strand % 7 === 0 ? 0.35 : 0),
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const line = new THREE.Line(geometry, material);
      sculpture.add(line);
      objects.push({ geometry, material });
    }
    sculpture.rotation.z = -0.27;
    let targetX = 0,
      targetY = 0,
      frame = 0,
      clock = 0,
      previous = performance.now();
    const resize = () => {
      const { width, height } = el.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      if (framed) {
        // Centre the sculpture inside its own panel instead of composing it around text.
        sculpture.position.set(-4.3, 1.2, 0);
        camera.position.z = Math.max(
          20,
          9.5 / (Math.tan(THREE.MathUtils.degToRad(20)) * camera.aspect),
        );
      } else {
        sculpture.position.x = width < 650 ? -2 : 1.5;
        sculpture.position.y = width < 650 ? -5.7 : -0.3;
      }
      renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const move = (e: PointerEvent) => {
      targetX = (e.clientX / innerWidth - 0.5) * 0.25;
      targetY = (e.clientY / innerHeight - 0.5) * 0.2;
    };
    window.addEventListener('pointermove', move, { passive: true });
    const render = (now: number) => {
      const dt = Math.min((now - previous) / 1000, 0.05);
      previous = now;
      if (!pause.current && !document.hidden) {
        clock += dt;
        sculpture.rotation.x = Math.sin(clock * 0.16) * 0.14 + targetY;
        sculpture.rotation.y +=
          (targetX + Math.sin(clock * 0.12) * 0.06 - sculpture.rotation.y) * 0.025;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    resize();
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', move);
      objects.forEach((o) => {
        o.geometry.dispose();
        o.material.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [framed]);
  return (
    <div className="light-field" aria-hidden="true" ref={host}>
      {failed && <img src="/light-field.png" alt="" />}
    </div>
  );
}
