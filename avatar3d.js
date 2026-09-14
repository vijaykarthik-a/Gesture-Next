/* 3D Smart Glove avatar - Three.js + Mixamo FBX animations */
(() => {
  const MODEL_DIR = "models/";
  const files = {
    avatar: MODEL_DIR + "avatar.fbx",
    hello: MODEL_DIR + "Shaking Hands 2.fbx",
    water: MODEL_DIR + "Fishing Idle.fbx",
    emergency: MODEL_DIR + "Start Climbing Ladder.fbx"
  };

  let scene, camera, renderer, mixer, avatar, clock;
  let actions = {};
  let activeAction = null;
  let ready = false;
  let resizeObserver = null;
  const containerId = "avatar3dContainer";

  function status(message, error=false) {
    const el = document.getElementById("avatar3dStatus");
    if (el) {
      el.textContent = message;
      el.classList.toggle("error", !!error);
    }
  }

  function loadExternalScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = false;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load: " + url));
      document.head.appendChild(script);
    });
  }

  async function loadLibraries() {
    // Load Three.js first. FBXLoader 0.146 also requires the global fflate
    // decompression library, so load that before FBXLoader.
    if (!window.THREE) {
      const urls = [
        "https://cdn.jsdelivr.net/npm/three@0.146.0/build/three.min.js",
        "https://unpkg.com/three@0.146.0/build/three.min.js"
      ];
      let ok = false;
      for (const url of urls) {
        try { await loadExternalScript(url); if (window.THREE) { ok = true; break; } }
        catch (e) { console.warn(e); }
      }
      if (!ok) throw new Error("Three.js could not be loaded.");
    }
    if (!window.fflate) {
      const urls = [
        "https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js",
        "https://unpkg.com/fflate@0.8.2/umd/index.js"
      ];
      let ok = false;
      for (const url of urls) {
        try {
          await loadExternalScript(url);
          if (window.fflate) { ok = true; break; }
        } catch (e) { console.warn(e); }
      }
      if (!ok) throw new Error("fflate could not be loaded. FBXLoader requires it.");
    }

    if (!window.THREE.FBXLoader) {
      const urls = [
        "https://cdn.jsdelivr.net/npm/three@0.146.0/examples/js/loaders/FBXLoader.js",
        "https://unpkg.com/three@0.146.0/examples/js/loaders/FBXLoader.js"
      ];
      let ok = false;
      for (const url of urls) {
        try { await loadExternalScript(url); if (window.THREE.FBXLoader) { ok = true; break; } }
        catch (e) { console.warn(e); }
      }
      if (!ok) throw new Error("FBXLoader could not be loaded.");
    }
  }

  function setup() {
    const container = document.getElementById(containerId);
    if (!container || !window.THREE) return false;

    scene = new THREE.Scene();
    scene.background = null;

    const w = Math.max(container.clientWidth, 320);
    const h = Math.max(container.clientHeight, 430);
    camera = new THREE.PerspectiveCamera(30, w / h, 0.01, 1000);
    camera.position.set(0, 1.35, 4.7);

    renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:"high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = "avatar3d-canvas";
    renderer.setClearColor(0x000000, 0);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c7dd, 2.0);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 6, 5);
    key.castShadow = true;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x9db7ff, 1.0);
    fill.position.set(-4, 2, 3);
    scene.add(fill);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 64),
      new THREE.MeshStandardMaterial({ color:0xdfe7f6, transparent:true, opacity:.48, roughness:1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    ground.scale.set(1.25,1.25,1.25);
    ground.receiveShadow = true;
    scene.add(ground);

    clock = new THREE.Clock();
    animate();

    const resize = () => {
      if (!renderer || !camera || !container) return;
      const width = Math.max(container.clientWidth, 280);
      const height = Math.max(container.clientHeight, 380);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    window.addEventListener("resize", resize);
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }
    resize();
    return true;
  }

  function fitAvatar() {
    if (!avatar || !camera) return;

    // Fit the COMPLETE humanoid, including the head and feet.  The previous
    // fixed camera distance could crop the head on some Mixamo FBX exports.
    const rawBox = new THREE.Box3().setFromObject(avatar);
    const rawSize = rawBox.getSize(new THREE.Vector3());
    if (!isFinite(rawSize.y) || rawSize.y <= 0) return;

    const targetHeight = 2.85;
    avatar.scale.setScalar(targetHeight / rawSize.y);

    // Recalculate after scaling and center the character horizontally.
    const box = new THREE.Box3().setFromObject(avatar);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const floorY = -1.38;

    avatar.position.x -= center.x;
    avatar.position.z -= center.z;
    avatar.position.y += floorY - box.min.y;

    // Give the full body a little breathing room.  Compute camera distance
    // from the actual avatar height instead of relying on one fixed value.
    const framedBox = new THREE.Box3().setFromObject(avatar);
    const framedSize = framedBox.getSize(new THREE.Vector3());
    const targetY = (framedBox.min.y + framedBox.max.y) * 0.5 + 0.03;
    const verticalFov = THREE.MathUtils.degToRad(camera.fov);
    const padding = 1.18;
    const distance = Math.max(4.9, (framedSize.y * 0.5 * padding) / Math.tan(verticalFov * 0.5));

    camera.position.set(0, targetY, distance);
    camera.lookAt(0, targetY, 0);
  }

  function loadFBX(url) {
    return new Promise((resolve, reject) => {
      const loader = new THREE.FBXLoader();
      loader.load(url, resolve, undefined, reject);
    });
  }

  function collectAnimation(object, name) {
    if (!object || !object.animations || !object.animations.length || !mixer) return false;
    const clip = object.animations[0];
    clip.name = name;
    const action = mixer.clipAction(clip);
    action.clampWhenFinished = true;
    actions[name] = action;
    return true;
  }

  function cleanTempObject(object) {
    object.traverse(node => {
      if (node.isMesh) {
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(m => m?.dispose?.());
        else node.material?.dispose?.();
      }
    });
  }

  async function loadAvatarAndAnimations() {
    status("Loading 3D avatar…");
    const main = await loadFBX(files.avatar);
    avatar = main;
    avatar.traverse(node => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;
        if (node.material) node.material.side = THREE.FrontSide;
      }
    });
    scene.add(avatar);
    fitAvatar();
    mixer = new THREE.AnimationMixer(avatar);

    // The Mixamo animation FBX files use the same humanoid bone names as the avatar.
    // We load their animation clips but do not add their duplicate meshes to the scene.
    const animationFiles = [
      ["hello", files.hello],
      ["water", files.water],
      ["emergency", files.emergency]
    ];

    let loaded = 0;
    for (const [name, url] of animationFiles) {
      try {
        const obj = await loadFBX(url);
        if (collectAnimation(obj, name)) loaded++;
        cleanTempObject(obj);
      } catch (err) {
        console.warn("Could not load animation", name, err);
      }
    }

    if (!loaded) throw new Error("No Mixamo animations could be attached to the avatar.");

    // Keep the avatar in its natural standing pose until a gesture is triggered.
    // This is important because the supplied Fishing Idle file must remain a real
    // WATER animation instead of being used as the permanent idle animation.
    ready = true;
    status("Avatar ready");
    updateLabel("Ready");
  }

  function updateLabel(text) {
    const label = document.getElementById("avatar3dExpression");
    if (label) label.textContent = text;
  }

  function play(name, label) {
    if (!ready || !actions[name]) return false;
    const next = actions[name];
    if (activeAction === next) return true;

    if (activeAction) activeAction.fadeOut(0.18);
    next.reset();
    next.setLoop(THREE.LoopOnce, 1);
    next.clampWhenFinished = true;
    next.fadeIn(0.18).play();
    activeAction = next;
    updateLabel(label || name.toUpperCase());

    const once = (event) => {
      if (event.action !== next) return;
      mixer.removeEventListener("finished", once);
      if (activeAction === next) {
        next.fadeOut(0.18);
        activeAction = null;
        updateLabel("Ready");
      }
    };
    mixer.addEventListener("finished", once);
    return true;
  }

  function playForSpeech(text) {
    const t = String(text || "").toLowerCase();
    if (/(^|\b)(hello|hi|hey)\b/.test(t)) return play("hello", "Hello — waving");
    if (/(^|\b)(water|thirsty|open the bottle|open bottle)\b/.test(t)) return play("water", "Open the bottle");
    if (/(^|\b)(emergency|danger|help|sos|run quickly|run fast|quickly run)\b/.test(t)) return play("emergency", "Run quickly");
    return false;
  }

  async function init() {
    try {
      setup();
      await loadLibraries();
      setup();
      await loadAvatarAndAnimations();
    } catch (err) {
      console.error("3D avatar initialization failed", err);
      status("Avatar could not load. Check internet connection, then refresh the page.", true);
      updateLabel("3D avatar unavailable");
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    if (mixer && clock) mixer.update(clock.getDelta());
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  window.Avatar3D = {
    init,
    play,
    playForSpeech,
    isReady: () => ready
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once:true });
  else init();
})();
