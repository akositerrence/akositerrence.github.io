import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const shell = document.getElementById("portfolioTitle3DShell");
const canvas = document.getElementById("portfolioTitle3DCanvas");
const crop = shell?.closest(".portfolio-title-3d-crop");

if (!shell || !canvas) throw new Error("Missing #portfolioTitle3DShell or #portfolioTitle3DCanvas");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(15, 1, 0.01, 1000);
camera.position.set(0, 0, 8);
camera.lookAt(0, 0, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.25));

const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(5, 5, 8);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 1.8);
fill.position.set(-4, 2, 6);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 1.2);
rim.position.set(0, -3, 4);
scene.add(rim);

const MODEL_URL = "/src/media/models/cowbot.glb";
const MOBILE_QUERY = window.matchMedia("(max-width: 767px)");

const BASE_ROT_X = THREE.MathUtils.degToRad(90);
const BASE_ROT_Y = THREE.MathUtils.degToRad(180);
const DESKTOP_ROT_Z = THREE.MathUtils.degToRad(-170);
const MOBILE_ROT_Z = THREE.MathUtils.degToRad(-180);

const DESKTOP_POS_X = 1.125;
const MOBILE_POS_X = 0;
const MODEL_POS_Y = -1.625;
const MODEL_POS_Z = 0;

const MODEL_TARGET_SIZE = 7;
const ROTATION_SPEED = 0.0125;
const CAMERA_MOVE_SPEED = 0.05;
const CAMERA_MOVE_DISTANCE = 3;

let model = null;
let isMobile = MOBILE_QUERY.matches;
let baseRotZ = isMobile ? MOBILE_ROT_Z : DESKTOP_ROT_Z;
let targetRotX = BASE_ROT_X;
let currentRotX = BASE_ROT_X;
let baseCameraX = 0;
let baseCameraY = 0;
let baseCameraZ = 0;
let targetCameraX = 0;
let currentCameraX = 0;

function resizeRenderer() {
    const rect = shell.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

function updateResponsiveLayout() {
    isMobile = MOBILE_QUERY.matches;
    baseRotZ = isMobile ? MOBILE_ROT_Z : DESKTOP_ROT_Z;

    if (isMobile) {
        if (crop) {
            crop.style.width = "100%";
            crop.style.maxWidth = "none";
            crop.style.alignSelf = "stretch";
        }
        shell.style.width = "100%";
        shell.style.maxWidth = "none";
        shell.style.alignSelf = "stretch";
    } else {
        if (crop) {
            crop.style.width = "";
            crop.style.maxWidth = "";
            crop.style.alignSelf = "";
        }
        shell.style.width = "";
        shell.style.maxWidth = "";
        shell.style.alignSelf = "";
    }

    targetRotX = BASE_ROT_X;
    currentRotX = BASE_ROT_X;
    targetCameraX = baseCameraX;
    currentCameraX = baseCameraX;

    if (model) {
        model.position.set(isMobile ? MOBILE_POS_X : DESKTOP_POS_X, MODEL_POS_Y, MODEL_POS_Z);
        model.rotation.set(BASE_ROT_X, BASE_ROT_Y, baseRotZ);
    }

    requestAnimationFrame(resizeRenderer);
}

resizeRenderer();
updateResponsiveLayout();

window.addEventListener("resize", resizeRenderer);
MOBILE_QUERY.addEventListener("change", updateResponsiveLayout);

const resizeObserver = new ResizeObserver(resizeRenderer);
resizeObserver.observe(shell);
if (crop) resizeObserver.observe(crop);

const loader = new GLTFLoader();

loader.load(
    MODEL_URL,
    (gltf) => {
        model = gltf.scene;
        scene.add(model);

        model.traverse((child) => {
            if (!child.isMesh) return;

            child.visible = true;
            child.frustumCulled = false;
            child.castShadow = false;
            child.receiveShadow = false;

            if (Array.isArray(child.material)) {
                child.material = child.material.map((material) => {
                    const clonedMaterial = material.clone();
                    if (clonedMaterial.color) clonedMaterial.color.set("#e5e7eb");
                    if (clonedMaterial.emissive) clonedMaterial.emissive.set("#000000");
                    return clonedMaterial;
                });
            } else if (child.material) {
                child.material = child.material.clone();
                if (child.material.color) child.material.color.set("#e5e7eb");
                if (child.material.emissive) child.material.emissive.set("#000000");
            }
        });

        const rawBox = new THREE.Box3().setFromObject(model);
        const rawCenter = rawBox.getCenter(new THREE.Vector3());
        model.position.sub(rawCenter);

        const centeredBox = new THREE.Box3().setFromObject(model);
        const centeredSize = centeredBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(centeredSize.x, centeredSize.y, centeredSize.z);

        if (maxDim > 0) model.scale.setScalar(MODEL_TARGET_SIZE / maxDim);

        model.position.set(isMobile ? MOBILE_POS_X : DESKTOP_POS_X, MODEL_POS_Y, MODEL_POS_Z);
        model.rotation.set(BASE_ROT_X, BASE_ROT_Y, baseRotZ);
        model.updateMatrixWorld(true);

        const fittedBox = new THREE.Box3().setFromObject(model);
        const fittedSize = fittedBox.getSize(new THREE.Vector3());
        const fittedMaxDim = Math.max(fittedSize.x, fittedSize.y, fittedSize.z);
        const fov = THREE.MathUtils.degToRad(camera.fov);

        let cameraZ = (fittedMaxDim / 2) / Math.tan(fov / 2);
        cameraZ *= 0.8;

        camera.position.set(0, fittedMaxDim * 0.12, cameraZ);
        camera.near = Math.max(cameraZ / 100, 0.01);
        camera.far = cameraZ * 20;
        camera.updateProjectionMatrix();
        camera.lookAt(0, 0, 0);

        baseCameraX = camera.position.x;
        baseCameraY = camera.position.y;
        baseCameraZ = camera.position.z;
        targetCameraX = baseCameraX;
        currentCameraX = baseCameraX;

        updateResponsiveLayout();
    },
    undefined,
    (error) => console.error("GLTF load error:", error)
);

document.addEventListener("pointermove", (event) => {
    if (isMobile) return;

    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = (event.clientY / window.innerHeight) * 2 - 1;

    targetRotX = BASE_ROT_X + ny * 0.25;
    targetCameraX = baseCameraX - nx * CAMERA_MOVE_DISTANCE;
});

document.addEventListener("pointerleave", () => {
    targetRotX = BASE_ROT_X;
    targetCameraX = baseCameraX;
});

function animate() {
    requestAnimationFrame(animate);

    if (model) {
        currentRotX += (targetRotX - currentRotX) * ROTATION_SPEED;
        currentCameraX += (targetCameraX - currentCameraX) * CAMERA_MOVE_SPEED;

        model.rotation.set(currentRotX, BASE_ROT_Y, baseRotZ);
        camera.position.set(currentCameraX, baseCameraY, baseCameraZ);
        camera.lookAt(0, 0, 0);
    }

    renderer.render(scene, camera);
}

animate();
