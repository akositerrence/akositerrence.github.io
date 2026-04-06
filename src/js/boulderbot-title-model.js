import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const shell = document.getElementById("portfolioTitle3DShell");
const canvas = document.getElementById("portfolioTitle3DCanvas");

if (!shell || !canvas) {
    throw new Error("Missing #portfolioTitle3DShell or #portfolioTitle3DCanvas");
}

const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);
camera.position.set(0, 0, 8);
camera.lookAt(0, 0, 0);

const ambient = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffffff, 2.6);
key.position.set(5, 5, 8);
scene.add(key);

const fill = new THREE.DirectionalLight(0xffffff, 1.8);
fill.position.set(-4, 2, 6);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 1.2);
rim.position.set(0, -3, 4);
scene.add(rim);

let model = null;

function resizeRenderer() {
    const rect = shell.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
}

resizeRenderer();
window.addEventListener("resize", resizeRenderer);

const loader = new GLTFLoader();
const MODEL_URL = "/src/media/models/boulderbot.glb";

const BASE_ROT_X = -Math.PI / 2;
const BASE_ROT_Y = 0;

let targetRotX = BASE_ROT_X;
let currentRotX = BASE_ROT_X;

let baseCameraX = 0;
let baseCameraY = 0;
let baseCameraZ = 8;

let targetCameraX = 0;
let currentCameraX = 0;

loader.load(
    MODEL_URL,
    (gltf) => {
        model = gltf.scene;
        scene.add(model);

        model.traverse((child) => {
            if (child.isMesh) {
                child.visible = true;
                child.frustumCulled = false;
                child.castShadow = false;
                child.receiveShadow = false;

                if (Array.isArray(child.material)) {
                    child.material = child.material.map((mat) => {
                        const m = mat.clone();
                        m.color.set("#ffffff"); 
                        if ("emissive" in m) m.emissive.set("#000000");
                        return m;
                    });
                } else {
                    child.material = child.material.clone();
                    child.material.color.set("#ffffff"); 
                    if ("emissive" in child.material) child.material.emissive.set("#000000");
                }
            }
        });

        const rawBox = new THREE.Box3().setFromObject(model);
        const rawCenter = rawBox.getCenter(new THREE.Vector3());

        model.position.sub(rawCenter);

        const centeredBox = new THREE.Box3().setFromObject(model);
        const centeredSize = centeredBox.getSize(new THREE.Vector3());
        const maxDim = Math.max(centeredSize.x, centeredSize.y, centeredSize.z);

        if (maxDim > 0) {
            const targetSize = 7.0;
            const scale = targetSize / maxDim;
            model.scale.setScalar(scale);
        }

        model.position.set(0, -0.25, 0);
        model.rotation.x = BASE_ROT_X;
        model.rotation.y = BASE_ROT_Y;

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
    },
    undefined,
    (error) => {
        console.error("GLTF load error:", error);
    }
);

document.addEventListener("pointermove", (event) => {
    const nx = (event.clientX / window.innerWidth) * 2 - 1;
    const ny = (event.clientY / window.innerHeight) * 2 - 1;

    targetRotX = BASE_ROT_X + ny * 0.25;
    targetCameraX = baseCameraX - nx * 3;
});

document.addEventListener("pointerleave", () => {
    targetRotX = BASE_ROT_X;
    targetCameraX = baseCameraX;
});

function animate() {
    requestAnimationFrame(animate);

    if (model) {
        currentRotX += (targetRotX - currentRotX) * 0.08;
        currentCameraX += (targetCameraX - currentCameraX) * 0.08;

        model.rotation.x = currentRotX;
        model.rotation.y = BASE_ROT_Y;

        camera.position.set(currentCameraX, baseCameraY, baseCameraZ);
        camera.lookAt(0, 0, 0);
    }

    renderer.render(scene, camera);
}

animate();