"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type ViewMode = "3d" | "2d";

export function HouseCardViewer() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("3d");

  useEffect(() => {
    document.body.classList.add("ha-house-page");
    document.documentElement.classList.add("ha-house-page");
    const appShell = document.querySelector(".app-shell");
    appShell?.classList.add("ha-house-page-shell");

    return () => {
      document.body.classList.remove("ha-house-page");
      document.documentElement.classList.remove("ha-house-page");
      appShell?.classList.remove("ha-house-page-shell");
    };
  }, []);

  useEffect(() => {
    if (viewMode !== "3d" || !mountRef.current) {
      return;
    }

    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#d8e0ea");
    scene.fog = new THREE.Fog("#d8e0ea", 24, 62);

    const camera = new THREE.PerspectiveCamera(
      40,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      100
    );
    camera.position.set(4.8, 3.2, 6.4);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const hemiLight = new THREE.HemisphereLight("#ffffff", "#c4ccd8", 1.9);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight("#ffffff", 2.4);
    keyLight.position.set(6, 8, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight("#d3dae5", 1.15);
    fillLight.position.set(-5, 5, -3);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(14, 28, "#9ba8ba", "#c6d0dc");
    grid.position.y = 0.01;
    scene.add(grid);

    const gridMaterial = Array.isArray(grid.material) ? grid.material : [grid.material];
    const modelMaterials: Array<{
      material: THREE.MeshStandardMaterial;
      originalMap: THREE.Texture | null;
      originalEmissiveMap: THREE.Texture | null;
    }> = [];
    const outlineMaterials: THREE.LineBasicMaterial[] = [];
    const outlineGeometries: THREE.BufferGeometry[] = [];

    const applyLightTheme = () => {
      scene.background = new THREE.Color("#d9ecff");
      scene.fog = new THREE.Fog("#d9ecff", 24, 62);

      hemiLight.color.set("#ffffff");
      hemiLight.groundColor.set("#9db6d3");
      keyLight.color.set("#ffffff");
      fillLight.color.set("#d9c3a4");
      modelMaterials.forEach(({ material, originalMap, originalEmissiveMap }) => {
        material.map = originalMap;
        material.emissiveMap = originalEmissiveMap;
        material.color.set("#bf9161");
        material.emissive.set("#7a5731");
        material.emissiveIntensity = 0.08;
        material.metalness = 0.02;
        material.roughness = 0.72;
        material.needsUpdate = true;
      });
      outlineMaterials.forEach((material) => {
        material.color.set("#6c4928");
        material.opacity = 0.34;
      });

      gridMaterial.forEach((material, index) => {
        material.color.set(index === 0 ? "#6f96c2" : "#a9c4e2");
      });
    };

    applyLightTheme();

    const group = new THREE.Group();
    scene.add(group);

    let frameId = 0;
    let disposed = false;
    let dragging = false;
    let pointerX = 0;
    let pointerY = 0;
    let targetRotationY = -0.35;
    let targetRotationX = -0.16;

    const updateCamera = (object: THREE.Object3D) => {
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);

      object.position.sub(center);
      object.position.y += size.y * 0.5;

      const verticalDistance = maxDim / (2 * Math.tan((camera.fov * Math.PI) / 360));
      const horizontalFov =
        2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
      const horizontalDistance = maxDim / (2 * Math.tan(horizontalFov / 2));
      const isNarrow = camera.aspect < 0.8;
      const distance = Math.max(verticalDistance, horizontalDistance) * (isNarrow ? 1.12 : 1.35);

      camera.position.set(
        distance * (isNarrow ? 0.82 : 1.08),
        Math.max(size.y * (isNarrow ? 0.72 : 0.9), distance * (isNarrow ? 0.44 : 0.52)),
        distance * (isNarrow ? 0.94 : 1.18)
      );
      camera.lookAt(0, size.y * (isNarrow ? 0.3 : 0.38), 0);
      camera.updateProjectionMatrix();
    };

    const resize = () => {
      if (!mount.clientWidth || !mount.clientHeight) {
        return;
      }

      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.fov = camera.aspect < 0.8 ? 52 : 40;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };

    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      mount.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }

      const deltaX = event.clientX - pointerX;
      const deltaY = event.clientY - pointerY;
      pointerX = event.clientX;
      pointerY = event.clientY;

      targetRotationY += deltaX * 0.008;
      targetRotationX = THREE.MathUtils.clamp(targetRotationX + deltaY * 0.004, -0.65, 0.15);
    };

    const stopDragging = (event: PointerEvent) => {
      dragging = false;
      if (mount.hasPointerCapture(event.pointerId)) {
        mount.releasePointerCapture(event.pointerId);
      }
    };

    mount.addEventListener("pointerdown", onPointerDown);
    mount.addEventListener("pointermove", onPointerMove);
    mount.addEventListener("pointerup", stopDragging);
    mount.addEventListener("pointerleave", stopDragging);
    window.addEventListener("resize", resize);

    const loader = new GLTFLoader();
    loader.load(
      "/models/house.glb",
      (gltf) => {
        if (disposed) {
          return;
        }

        gltf.scene.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
            node.receiveShadow = true;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((material) => {
              if (material instanceof THREE.MeshStandardMaterial) {
                modelMaterials.push({
                  material,
                  originalMap: material.map,
                  originalEmissiveMap: material.emissiveMap
                });
              }
            });

            const outlineGeometry = new THREE.EdgesGeometry(node.geometry, 38);
            const outlineMaterial = new THREE.LineBasicMaterial({
              color: "#5d7aa8",
              transparent: true,
              opacity: 0.28
            });
            const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
            outline.renderOrder = 2;
            node.add(outline);
            outlineGeometries.push(outlineGeometry);
            outlineMaterials.push(outlineMaterial);
          }
        });

        group.add(gltf.scene);
        updateCamera(gltf.scene);
        applyLightTheme();
      },
      undefined,
      () => undefined
    );

    const animate = () => {
      frameId = window.requestAnimationFrame(animate);
      if (!dragging) {
        targetRotationY += 0.0025;
      }

      group.rotation.y += (targetRotationY - group.rotation.y) * 0.08;
      group.rotation.x += (targetRotationX - group.rotation.x) * 0.08;
      renderer.render(scene, camera);
    };

    resize();
    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      mount.removeEventListener("pointerdown", onPointerDown);
      mount.removeEventListener("pointermove", onPointerMove);
      mount.removeEventListener("pointerup", stopDragging);
      mount.removeEventListener("pointerleave", stopDragging);

      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) {
          return;
        }

        object.geometry.dispose();

        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
          return;
        }

        object.material.dispose();
      });

      outlineGeometries.forEach((geometry) => geometry.dispose());
      outlineMaterials.forEach((material) => material.dispose());

      renderer.dispose();
      mount.innerHTML = "";
    };
  }, [viewMode]);

  return (
    <section className="ha-house-shell ha-house-fullbleed">
      <div className="ha-house-stage">
        <div className="ha-house-tabs" role="tablist" aria-label="House view mode">
          <button
            type="button"
            className={viewMode === "3d" ? "ha-house-tab is-active" : "ha-house-tab"}
            onClick={() => setViewMode("3d")}
            aria-selected={viewMode === "3d"}
          >
            3D
          </button>
          <button
            type="button"
            className={viewMode === "2d" ? "ha-house-tab is-active" : "ha-house-tab"}
            onClick={() => setViewMode("2d")}
            aria-selected={viewMode === "2d"}
          >
            2D
          </button>
        </div>

        {viewMode === "3d" ? (
          <div ref={mountRef} className="ha-house-canvas" />
        ) : (
          <div className="ha-house-placeholder">
            <div className="ha-house-blueprint">
              <span>2D</span>
              <p>2D placeholder</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
