import React, { useEffect, useRef, useState } from 'react';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EngineeringMetrics } from '../cad/engineeringMath';
import { buildCinematicStage, CinematicStageHandles } from '../cad/cinematicStage3D';
import { ExplainerFrameState } from '../cad/explainerTimeline';
import { FilmFrameState } from '../cad/filmProduction';
import { buildVcaSlabAssembly, SlabAssemblyHandles } from '../cad/slabGeometry';
import {
  SLAB_COMPONENTS,
  SlabComponentId,
  SlabParameters,
  VIEW_PRESETS,
  ViewPresetId,
} from '../cad/types';

interface SlabViewport3DProps {
  params: SlabParameters;
  metrics: EngineeringMetrics;
  activeView: ViewPresetId;
  explodeMotion: MotionValue<number>;
  selectedComponent: SlabComponentId | null;
  sectionEnabled: boolean;
  sectionOffsetMm: number;
  showCallouts: boolean;
  directorFrame?: ExplainerFrameState | null;
  filmFrame?: FilmFrameState | null;
  onCanvasReady?: (canvas: HTMLCanvasElement | null) => void;
  onSelectComponent: (id: SlabComponentId | null) => void;
}

interface ProjectedCallout {
  id: SlabComponentId;
  calloutNumber: number;
  shortName: string;
  x: number;
  y: number;
  visible: boolean;
}

// Module-level scratch vectors to avoid GC inside render/animation loop
const _scratchVec = new THREE.Vector3();
const _targetCamPos = new THREE.Vector3();
const _targetControlsPos = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export const SlabViewport3D: React.FC<SlabViewport3DProps> = ({
  params,
  metrics,
  activeView,
  explodeMotion,
  selectedComponent,
  sectionEnabled,
  sectionOffsetMm,
  showCallouts,
  directorFrame = null,
  filmFrame = null,
  onCanvasReady,
  onSelectComponent,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [callouts, setCallouts] = useState<ProjectedCallout[]>([]);

  // Mutable refs so scene updates never tear down WebGLRenderer
  const stateRef = useRef({
    params,
    metrics,
    explodeCurrent: explodeMotion.get(),
    selectedComponent,
    sectionEnabled,
    sectionOffsetMm,
    showCallouts,
    directorFrame,
    filmFrame,
    onCanvasReady,
    onSelectComponent,
  });
  stateRef.current.params = params;
  stateRef.current.metrics = metrics;
  stateRef.current.selectedComponent = selectedComponent;
  stateRef.current.sectionEnabled = sectionEnabled;
  stateRef.current.sectionOffsetMm = sectionOffsetMm;
  stateRef.current.showCallouts = showCallouts;
  stateRef.current.directorFrame = directorFrame;
  stateRef.current.filmFrame = filmFrame;
  stateRef.current.onCanvasReady = onCanvasReady;
  stateRef.current.onSelectComponent = onSelectComponent;

  const engineRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    slabHandles: SlabAssemblyHandles | null;
    cinematicStage: CinematicStageHandles | null;
    clipPlane: THREE.Plane;
    isSoftwareGl: boolean;
    maxAnisotropy: number;
    requestRender: () => void;
    cameraTransitioning: boolean;
    rebuildSlab: () => void;
  } | null>(null);

  // Initialize Three.js WebGLRenderer & studio rig once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        preserveDrawingBuffer: true,
      });
    } catch {
      setWebglError('WebGL2 context unavailable in this browser.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;
    renderer.setSize(width, height);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.setAttribute('data-testid', 'vca-3d-canvas');
    container.appendChild(renderer.domElement);
    stateRef.current.onCanvasReady?.(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x03050a);
    scene.fog = new THREE.FogExp2(0x03050a, 0.0014);

    // Studio reflection environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envRT.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // Three-point warm/cool studio softbox lighting matching VCA reference look
    const hemiLight = new THREE.HemisphereLight(0xcfe8ff, 0x050811, 0.72);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xf8fafc, 1.95);
    keyLight.position.set(110, 140, 130);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 20;
      keyLight.shadow.camera.far = 420;
      keyLight.shadow.camera.left = -110;
      keyLight.shadow.camera.right = 110;
      keyLight.shadow.camera.top = 110;
      keyLight.shadow.camera.bottom = -110;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;

      RectAreaLightUniformsLib.init();
      const softboxRight = new THREE.RectAreaLight(0x7dd3fc, 4.2, 65, 165);
      softboxRight.position.set(95, 25, 110);
      softboxRight.lookAt(0, 0, 0);
      scene.add(softboxRight);

      const softboxLeft = new THREE.RectAreaLight(0xe0f2fe, 3.0, 55, 150);
      softboxLeft.position.set(-105, 40, 90);
      softboxLeft.lookAt(0, 0, 0);
      scene.add(softboxLeft);
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.45);
    rimLight.position.set(-120, 60, -140);
    scene.add(rimLight);

    // Architectural calibration grid stage below slab
    const stageY = -82;
    const grid = new THREE.GridHelper(360, 28, 0x164e63, 0x0b1322);
    grid.position.y = stageY;
    scene.add(grid);

    const shadowDiscGeo = new THREE.CircleGeometry(68, 32);
    const shadowDiscMat = new THREE.MeshBasicMaterial({
      color: 0x020617,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = stageY + 0.05;
    scene.add(shadowDisc);

    const camera = new THREE.PerspectiveCamera(36, width / height, 0.5, 1200);
    const initialPreset = VIEW_PRESETS[0];
    camera.position.set(...initialPreset.cameraPos);
    _targetCamPos.set(...initialPreset.cameraPos);
    _targetControlsPos.set(...initialPreset.target);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.08;
    controls.minDistance = 32;
    controls.maxDistance = 420;
    controls.target.set(...initialPreset.target);

    const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const cinematicStage = buildCinematicStage(stateRef.current.params.serialNumber);
    scene.add(cinematicStage.root);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let lastTime = performance.now();
    let calloutUpdateCounter = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (!gl || typeof gl.fenceSync !== 'function') {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const projectCallouts = (handles: SlabAssemblyHandles) => {
      if (!stateRef.current.showCallouts) {
        setCallouts((prev) => (prev.length === 0 ? prev : []));
        return;
      }
      const anchorMap: Record<SlabComponentId, [number, number]> = {
        front_housing: [-46, -54],
        perimeter_bezel: [-46, -12],
        hologram_qr_seal: [32, 62],
        cert_label: [-22, 60],
        nfc_antenna: [44, 48],
        nfc_chip: [44, 34],
        nfc_compartment: [44, 20],
        inner_sleeve: [-44, -34],
        trading_card: [44, -18],
        card_support_frame: [44, -38],
        tamper_weld_pins: [-46, 36],
        rear_housing: [46, -58],
      };

      const rect = renderer.domElement.getBoundingClientRect();
      const list: ProjectedCallout[] = [];
      for (const meta of SLAB_COMPONENTS) {
        const grp = handles.components[meta.id];
        if (!grp) continue;
        const [ax, ay] = anchorMap[meta.id] || [0, 0];
        _scratchVec.set(ax, ay, grp.position.z);
        _scratchVec.project(camera);
        const visible = _scratchVec.z < 1 && _scratchVec.z > -1;
        const x = ((_scratchVec.x + 1) / 2) * rect.width;
        const y = ((-_scratchVec.y + 1) / 2) * rect.height;
        list.push({
          id: meta.id,
          calloutNumber: meta.calloutNumber,
          shortName: meta.shortName,
          x,
          y,
          visible,
        });
      }
      setCallouts(list);
    };

    const requestRender = () => {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame((now) => {
        renderDirty = false;
        const dt = Math.min(0.1, Math.max(0.001, (now - lastTime) / 1000));
        lastTime = now;

        const eng = engineRef.current;
        const dirFrame = stateRef.current.directorFrame;
        const activeFilmFrame = stateRef.current.filmFrame;
        let needsAnotherFrame = false;

        if (dirFrame && eng) {
          controls.enabled = false;
          eng.cameraTransitioning = false;
          camera.position.set(...dirFrame.cameraPos);
          controls.target.set(...dirFrame.target);
          if (Math.abs(camera.fov - dirFrame.fov) > 0.05) {
            camera.fov = dirFrame.fov;
            camera.updateProjectionMatrix();
          }
          eng.slabHandles?.updateExplode(dirFrame.explode);
          eng.slabHandles?.setHousingXray(dirFrame.housingOpacity);
          eng.cinematicStage?.update(dirFrame, stateRef.current.params);
        } else if (activeFilmFrame && eng) {
          controls.enabled = false;
          eng.cameraTransitioning = false;
          camera.position.set(...activeFilmFrame.cameraPos);
          controls.target.set(...activeFilmFrame.target);
          if (Math.abs(camera.fov - activeFilmFrame.fov) > 0.05) {
            camera.fov = activeFilmFrame.fov;
            camera.updateProjectionMatrix();
          }
          if (eng.cinematicStage) {
            eng.cinematicStage.root.visible = false;
          }
          eng.slabHandles?.setHousingXray(1);
          eng.slabHandles?.applyAssemblyChoreography(activeFilmFrame.assembly);
        } else {
          controls.enabled = true;
          if (Math.abs(camera.fov - 36) > 0.05) {
            camera.fov = 36;
            camera.updateProjectionMatrix();
          }
          if (eng?.cinematicStage) {
            eng.cinematicStage.root.visible = false;
          }
          eng?.slabHandles?.setHousingXray(1);
          // Sync exploded layer separation from Framer Motion spring value
          eng?.slabHandles?.updateExplode(stateRef.current.explodeCurrent);

          // Smoothly damp camera preset transitions
          if (eng && eng.cameraTransitioning) {
            if (isSoftwareGl) {
              camera.position.copy(_targetCamPos);
              controls.target.copy(_targetControlsPos);
              eng.cameraTransitioning = false;
            } else {
              camera.position.x = THREE.MathUtils.damp(camera.position.x, _targetCamPos.x, 8, dt);
              camera.position.y = THREE.MathUtils.damp(camera.position.y, _targetCamPos.y, 8, dt);
              camera.position.z = THREE.MathUtils.damp(camera.position.z, _targetCamPos.z, 8, dt);
              controls.target.x = THREE.MathUtils.damp(controls.target.x, _targetControlsPos.x, 8, dt);
              controls.target.y = THREE.MathUtils.damp(controls.target.y, _targetControlsPos.y, 8, dt);
              controls.target.z = THREE.MathUtils.damp(controls.target.z, _targetControlsPos.z, 8, dt);
              if (
                camera.position.distanceTo(_targetCamPos) < 0.25 &&
                controls.target.distanceTo(_targetControlsPos) < 0.15
              ) {
                camera.position.copy(_targetCamPos);
                controls.target.copy(_targetControlsPos);
                eng.cameraTransitioning = false;
              } else {
                needsAnotherFrame = true;
              }
            }
          }
        }

        const ctrlUpdated = controls.update();
        if (ctrlUpdated && !isSoftwareGl) {
          needsAnotherFrame = true;
        }

        renderer.render(scene, camera);

        calloutUpdateCounter += 1;
        if (eng?.slabHandles && (!needsAnotherFrame || calloutUpdateCounter % 4 === 0)) {
          projectCallouts(eng.slabHandles);
        }

        const finishFrame = () => {
          renderBusy = false;
          if (renderDirty || needsAnotherFrame) {
            requestRender();
          }
        };

        if (isSoftwareGl) afterDraw(finishFrame);
        else finishFrame();
      });
    };

    const rebuildSlab = () => {
      const eng = engineRef.current;
      if (!eng) return;
      if (eng.slabHandles) {
        scene.remove(eng.slabHandles.root);
        eng.slabHandles.disposables.geometries.forEach((g) => g.dispose());
        eng.slabHandles.disposables.materials.forEach((m) => m.dispose());
        eng.slabHandles.disposables.textures.forEach((t) => t.dispose());
      }
      const handles = buildVcaSlabAssembly(stateRef.current.params, stateRef.current.metrics, {
        isSoftwareGl,
        maxAnisotropy,
        onTextureReady: () => requestRender(),
      });
      handles.updateExplode(stateRef.current.explodeCurrent);
      handles.setSelectedComponent(stateRef.current.selectedComponent);
      if (stateRef.current.sectionEnabled) {
        clipPlane.constant = stateRef.current.sectionOffsetMm;
        handles.setClipPlane(clipPlane);
      }
      scene.add(handles.root);
      eng.slabHandles = handles;
      requestRender();
    };

    engineRef.current = {
      scene,
      camera,
      renderer,
      controls,
      slabHandles: null,
      cinematicStage,
      clipPlane,
      isSoftwareGl,
      maxAnisotropy,
      requestRender,
      cameraTransitioning: false,
      rebuildSlab,
    };

    rebuildSlab();
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }
    requestRender();

    // Cancel camera transition if user manually grabs OrbitControls
    const onControlStart = () => {
      if (engineRef.current) {
        engineRef.current.cameraTransitioning = false;
      }
    };
    const onControlChange = () => requestRender();
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    // Raycast click to select individual physical slab component
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moved > 5) return; // Ignore orbit drags
      const eng = engineRef.current;
      if (!eng?.slabHandles) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(eng.slabHandles.root.children, true);
      if (hits.length > 0) {
        const compId = hits[0].object.userData.componentId as SlabComponentId | undefined;
        if (compId) {
          stateRef.current.onSelectComponent(compId);
          return;
        }
      }
      stateRef.current.onSelectComponent(null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('WebGL rendering context was interrupted. Reloading scene...');
    };
    const onContextRestored = () => {
      setWebglError(null);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = Math.max(100, Math.floor(entry.contentRect.width));
        const h = Math.max(100, Math.floor(entry.contentRect.height));
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestRender();
      }
    });
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      const eng = engineRef.current;
      if (eng?.slabHandles) {
        eng.slabHandles.disposables.geometries.forEach((g) => g.dispose());
        eng.slabHandles.disposables.materials.forEach((m) => m.dispose());
        eng.slabHandles.disposables.textures.forEach((t) => t.dispose());
      }
      eng?.cinematicStage?.dispose();
      grid.geometry.dispose();
      (grid.material as THREE.Material).dispose();
      shadowDiscGeo.dispose();
      shadowDiscMat.dispose();
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      stateRef.current.onCanvasReady?.(null);
      engineRef.current = null;
    };
  }, []);

  // Rebuild parametric geometry when physical dimensions or card/material settings change
  useEffect(() => {
    engineRef.current?.rebuildSlab();
  }, [params, metrics]);

  // Update selection highlight
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng?.slabHandles) return;
    eng.slabHandles.setSelectedComponent(selectedComponent);
    eng.requestRender();
  }, [selectedComponent]);

  // Subscribe to Framer Motion spring updates for 3D explode/collapse animation
  useEffect(() => {
    stateRef.current.explodeCurrent = explodeMotion.get();
    engineRef.current?.slabHandles?.updateExplode(stateRef.current.explodeCurrent);
    engineRef.current?.requestRender();

    const unsubscribe = explodeMotion.on('change', (latest) => {
      stateRef.current.explodeCurrent = latest;
      const eng = engineRef.current;
      if (eng?.slabHandles) {
        eng.slabHandles.updateExplode(latest);
        eng.requestRender();
      }
    });
    return () => unsubscribe();
  }, [explodeMotion]);

  // Refresh callout projection when callout visibility toggles
  useEffect(() => {
    engineRef.current?.requestRender();
  }, [showCallouts]);

  // Update clipping cross-section plane
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng?.slabHandles) return;
    if (sectionEnabled) {
      eng.clipPlane.constant = sectionOffsetMm;
      eng.slabHandles.setClipPlane(eng.clipPlane);
    } else {
      eng.slabHandles.setClipPlane(null);
    }
    eng.requestRender();
  }, [sectionEnabled, sectionOffsetMm]);

  // Trigger smooth camera preset transition
  useEffect(() => {
    if (directorFrame || filmFrame) return;
    const preset = VIEW_PRESETS.find((v) => v.id === activeView);
    const eng = engineRef.current;
    if (!preset || !eng) return;
    _targetCamPos.set(...preset.cameraPos);
    _targetControlsPos.set(...preset.target);
    eng.cameraTransitioning = true;
    eng.requestRender();
  }, [activeView, directorFrame, filmFrame]);

  // Trigger render when directorFrame or filmFrame advances
  useEffect(() => {
    if (!directorFrame && !filmFrame) return;
    engineRef.current?.requestRender();
  }, [directorFrame, filmFrame]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#090C11]">
      <div ref={containerRef} className="w-full h-full" />

      {/* Callout markers projected from 3D assembly components */}
      {showCallouts && callouts.length > 0 && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
          {callouts.map(
            (c) =>
              c.visible && (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectComponent(c.id)}
                  style={{
                    transform: `translate(${Math.round(c.x)}px, ${Math.round(c.y)}px) translate(-50%, -50%)`,
                  }}
                  className={`pointer-events-auto absolute top-0 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
                    selectedComponent === c.id
                      ? 'bg-[#0EA5E9] text-white border-[#38BDF8]'
                      : 'bg-[#0D121B]/95 text-[#E2E8F0] border-[#263248] hover:border-[#0EA5E9]'
                  }`}
                >
                  <span className="font-semibold">{c.calloutNumber}</span>
                  <span className="hidden sm:inline whitespace-nowrap">{c.shortName}</span>
                </button>
              )
          )}
        </div>
      )}

      {webglError && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#090C11]/95 p-6 z-20">
          <div className="max-w-md border border-[#1B2332] bg-[#11161F] rounded-lg p-6 text-center">
            <h3 className="text-base font-semibold text-white mb-2">3D Viewport Unavailable</h3>
            <p className="text-sm text-[#94A3B8]">{webglError}</p>
          </div>
        </div>
      )}
    </div>
  );
};
