document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const canvasContainer = document.getElementById('canvas-container');
    const colorBtns = document.querySelectorAll('.color-btn');
    const toast = document.getElementById('toast');
    const uiLayer = document.getElementById('ui-layer');
    const playerPanel = document.getElementById('player-panel');
    const loadingOverlay = document.getElementById('loading-overlay');

    // State
    let activeColor = 'W';
    let isSolvingTriggered = false;
    let isAnimatingMove = false;

    // Initialize Cube.js solver in the background
    if (typeof Cube !== 'undefined') {
        setTimeout(() => {
            Cube.initSolver();
        }, 500);
    }

    const hexColors = {
        'W': 0xffffff, 'Y': 0xffd500, 'G': 0x009e60,
        'B': 0x0051ba, 'O': 0xff5800, 'R': 0xc41e3a,
        'unpainted': 0x222222
    };

    let colorCounts = { 'W': 1, 'Y': 1, 'G': 1, 'B': 1, 'O': 1, 'R': 1 };
    
    let cubeState = {
        'F': Array(9).fill(null), 'R': Array(9).fill(null),
        'B': Array(9).fill(null), 'L': Array(9).fill(null),
        'U': Array(9).fill(null), 'D': Array(9).fill(null)
    };

    function getCenterColor(face) {
        const centers = { 'F': 'G', 'R': 'R', 'B': 'B', 'L': 'O', 'U': 'W', 'D': 'Y' };
        return centers[face];
    }

    ['F', 'R', 'B', 'L', 'U', 'D'].forEach(f => {
        cubeState[f][4] = getCenterColor(f);
    });

    // Three.js Setup
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(5.5, 5, 7.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    canvasContainer.appendChild(renderer.domElement);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 4;
    controls.maxDistance = 20;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.5);
    dirLight.position.set(5, 10, 15);
    scene.add(dirLight);

    const cubeGroup = new THREE.Group();
    scene.add(cubeGroup);
    
    const pivot = new THREE.Group();
    cubeGroup.add(pivot);

    const stickers = [];
    const cubies = [];

    const gap = 1.05;
    const cubieGeo = new THREE.BoxGeometry(1, 1, 1);
    const cubieMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const planeGeo = new THREE.PlaneGeometry(0.9, 0.9);

    function createSticker(parent, face, idx, pos, rot) {
        const isCenter = (idx === 4);
        const colorId = isCenter ? getCenterColor(face) : null;
        const mat = new THREE.MeshLambertMaterial({ color: colorId ? hexColors[colorId] : hexColors['unpainted'] });
        const mesh = new THREE.Mesh(planeGeo, mat);
        mesh.position.set(...pos);
        mesh.rotation.set(...rot);
        mesh.userData = { face, index: idx, color: colorId, isCenter };
        stickers.push(mesh);
        parent.add(mesh);
    }

    for (let x = -1; x <= 1; x++) {
        for (let y = -1; y <= 1; y++) {
            for (let z = -1; z <= 1; z++) {
                const cubie = new THREE.Mesh(cubieGeo, cubieMat);
                cubie.position.set(x * gap, y * gap, z * gap);
                cubies.push(cubie);
                cubeGroup.add(cubie);

                if (z === 1) createSticker(cubie, 'F', (1 - y) * 3 + (x + 1), [0, 0, 0.51], [0, 0, 0]);
                if (z === -1) createSticker(cubie, 'B', (1 - y) * 3 + (1 - x), [0, 0, -0.51], [0, Math.PI, 0]);
                if (x === 1) createSticker(cubie, 'R', (1 - y) * 3 + (1 - z), [0.51, 0, 0], [0, Math.PI/2, 0]);
                if (x === -1) createSticker(cubie, 'L', (1 - y) * 3 + (z + 1), [-0.51, 0, 0], [0, -Math.PI/2, 0]);
                if (y === 1) createSticker(cubie, 'U', (z + 1) * 3 + (x + 1), [0, 0.51, 0], [-Math.PI/2, 0, 0]);
                if (y === -1) createSticker(cubie, 'D', (1 - z) * 3 + (x + 1), [0, -0.51, 0], [Math.PI/2, 0, 0]);
            }
        }
    }

    // UI Interactions
    colorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            colorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeColor = btn.dataset.color;
        });
    });

    let toastTimeout;
    function showToast(msg) {
        toast.innerText = msg;
        toast.classList.add('show');
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function pulseMissingPieces() {
        let missingFound = false;
        stickers.forEach(sticker => {
            if (!sticker.userData.color && !sticker.userData.isCenter) {
                missingFound = true;
                let p = 0;
                function loop() {
                    p += 0.1;
                    if (p <= Math.PI) {
                        // Fade to red and back
                        let intensity = Math.floor(Math.sin(p) * 200);
                        sticker.material.emissive.setHex(intensity << 16);
                        requestAnimationFrame(loop);
                    } else {
                        sticker.material.emissive.setHex(0x000000);
                    }
                }
                loop();
            }
        });
        if (missingFound) {
            showToast("Please paint all 54 tiles to solve.");
        }
        return missingFound;
    }

    const triggerSolveBtn = document.getElementById('trigger-solve-btn');
    triggerSolveBtn.addEventListener('click', () => {
        if (!triggerSolveBtn.classList.contains('ready')) {
            pulseMissingPieces();
            return;
        }
        if (!isSolvingTriggered) {
            isSolvingTriggered = true;
            solveCubeLocal();
        }
    });

    // Reset all painted stickers back to unpainted
    function resetPainting() {
        stickers.forEach(sticker => {
            if (!sticker.userData.isCenter) {
                sticker.userData.color = null;
                sticker.material.color.setHex(hexColors['unpainted']);
                sticker.material.emissive.setHex(0x000000);
            }
        });

        // Reset cubeState (keep centers)
        ['F', 'R', 'B', 'L', 'U', 'D'].forEach(f => {
            cubeState[f] = Array(9).fill(null);
            cubeState[f][4] = getCenterColor(f);
        });

        // Reset color counts (1 each for the locked centers)
        colorCounts = { 'W': 1, 'Y': 1, 'G': 1, 'B': 1, 'O': 1, 'R': 1 };

        updatePaintedCount();
    }

    document.getElementById('reset-paint-btn').addEventListener('click', resetPainting);

    // Expose for mobile button
    window._resetPainting = resetPainting;

    function updatePaintedCount() {
        let count = 0;
        for (let f in cubeState) count += cubeState[f].filter(c => c !== null).length;
        
        document.getElementById('painted-count').innerHTML = `${count}<span>/54</span>`;
        document.getElementById('progress-bar-fill').style.width = `${(count/54)*100}%`;
        
        if (count === 54) {
            triggerSolveBtn.classList.add('ready');
        } else {
            triggerSolveBtn.classList.remove('ready');
        }
    }

    // Raycasting & Painting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredSticker = null;
    let pointerDownPos = { x: 0, y: 0 };

    window.addEventListener('pointerdown', (e) => {
        pointerDownPos = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointermove', (e) => {
        if (isAnimatingMove || isSolvingTriggered) return;
        
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(stickers);
        if (hoveredSticker) hoveredSticker.material.emissive.setHex(0x000000);
        
        if (intersects.length > 0) {
            const sticker = intersects[0].object;
            if (!sticker.userData.color && !sticker.userData.isCenter) {
                sticker.material.emissive.setHex(0x444444);
                hoveredSticker = sticker;
            }
        } else {
            hoveredSticker = null;
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (isAnimatingMove || isSolvingTriggered) return;
        
        let dx = e.clientX - pointerDownPos.x;
        let dy = e.clientY - pointerDownPos.y;
        if (Math.sqrt(dx*dx + dy*dy) > 5) return; // Was a drag (camera orbit)

        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const intersects = raycaster.intersectObjects(stickers);
        if (intersects.length > 0) {
            const sticker = intersects[0].object;
            if (sticker.userData.isCenter) {
                showToast("Center stickers are locked.");
                return;
            }

            const oldColor = sticker.userData.color;
            if (oldColor === activeColor) return;

            if (colorCounts[activeColor] >= 9) {
                showToast(`Maximum 9 ${activeColor} stickers allowed.`);
                return;
            }

            if (oldColor) colorCounts[oldColor]--;
            colorCounts[activeColor]++;

            sticker.userData.color = activeColor;
            sticker.material.color.setHex(hexColors[activeColor]);
            if (hoveredSticker === sticker) sticker.material.emissive.setHex(0x000000);
            
            cubeState[sticker.userData.face][sticker.userData.index] = activeColor;
            
            animatePop(sticker);
            updatePaintedCount();
        }
    });

    function animatePop(mesh) {
        let p = 0;
        function loop() {
            p += 0.1;
            if (p <= 1) {
                let s = 1 + 0.1 * Math.sin(p * Math.PI);
                mesh.scale.set(s, s, s);
                requestAnimationFrame(loop);
            } else {
                mesh.scale.set(1, 1, 1);
            }
        }
        loop();
    }

    // Animation Player Logic
    let solutionMoves = [];
    let currentMoveIdx = 0;
    let isPlaying = false;
    let playTimeout = null;
    let animationSpeed = 1.0;

    document.getElementById('speed-slider').addEventListener('input', (e) => {
        animationSpeed = parseFloat(e.target.value);
        document.getElementById('speed-label').innerText = animationSpeed.toFixed(1) + 'x';
    });

    function formatKociembaState(state) {
        const c2f = { 'W': 'U', 'R': 'R', 'G': 'F', 'Y': 'D', 'O': 'L', 'B': 'B' };
        let str = "";
        ['U', 'R', 'F', 'D', 'L', 'B'].forEach(face => {
            state[face].forEach(c => str += c2f[c]);
        });
        return str;
    }

    function handleSolveSuccess(solutionStr) {
        loadingOverlay.style.display = 'none';
        solutionMoves = solutionStr ? solutionStr.split(' ') : [];
        
        // Smooth UI Transition
        uiLayer.style.opacity = '0';
        uiLayer.style.transform = 'translateY(20px)';
        setTimeout(() => uiLayer.style.display = 'none', 500);
        
        document.getElementById('reset-btn').style.display = 'block';

        // Hide mobile toggle pill during solving
        const mobileToggle = document.getElementById('mobile-toggle');
        if (mobileToggle) mobileToggle.style.display = 'none';

        playerPanel.style.display = 'flex';
        void playerPanel.offsetWidth;
        playerPanel.classList.add('active');
        
        // Isometric view
        cubeGroup.quaternion.setFromEuler(new THREE.Euler(Math.PI/6, -Math.PI/4, 0));
        
        if (solutionMoves.length === 0) {
            document.getElementById('current-move-text').innerText = "Perfectly Solved";
            document.getElementById('play-pause-btn').style.display = 'none';
        } else {
            document.getElementById('current-move-text').innerText = `Sequence Ready`;
        }
    }

    function solveCubeLocal() {
        loadingOverlay.style.display = 'flex';
        
        setTimeout(() => {
            try {
                let cubeStr = formatKociembaState(cubeState);
                if (cubeStr === "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB") {
                    handleSolveSuccess("");
                    return;
                }

                let cube = Cube.fromString(cubeStr);
                let solution = cube.solve();
                if (!solution && solution !== "") {
                    throw new Error("Cube is unsolvable. Please check your colors.");
                }
                
                let solutionStr = solution.replace(/'/g, "i");
                handleSolveSuccess(solutionStr);
            } catch (err) {
                loadingOverlay.style.display = 'none';
                isSolvingTriggered = false;
                
                let eMsg = err.message || "Invalid cube state.";
                let fMsg = "The cube is unsolvable. Please double-check your colors.";
                
                // Generic mapping for cubejs errors
                if (eMsg.includes("facelet")) fMsg = "Incorrect colors! There must be exactly 9 tiles of each color.";
                else if (eMsg.includes("edges exist")) fMsg = "Invalid edges! Check for duplicate or missing edge pieces.";
                else if (eMsg.includes("flipped")) fMsg = "Wait! A single edge piece appears to be flipped impossibly.";
                else if (eMsg.includes("corners exist")) fMsg = "Invalid corners! Check for duplicate or missing corner pieces.";
                else if (eMsg.includes("twisted")) fMsg = "Hold on! A corner piece seems to be twisted impossibly.";
                else if (eMsg.includes("exchanged")) fMsg = "Impossible swap! Two pieces are exchanged.";
                
                showToast(fMsg);
            }
        }, 50);
    }

    function getMoveParams(move) {
        let baseMove = move.replace('2', '').replace('i', '');
        let isPrime = move.includes('i');
        let isDouble = move.includes('2');
        
        let axis;
        if (['R','L','M'].includes(baseMove)) axis = 'x';
        if (['U','D','E'].includes(baseMove)) axis = 'y';
        if (['F','B','S'].includes(baseMove)) axis = 'z';
        
        let dir = 1;
        if (baseMove === 'R') dir = -1;
        if (baseMove === 'L') dir = 1;
        if (baseMove === 'U') dir = -1;
        if (baseMove === 'D') dir = 1;
        if (baseMove === 'F') dir = -1;
        if (baseMove === 'B') dir = 1;
        if (baseMove === 'M') dir = 1;
        if (baseMove === 'E') dir = 1;
        if (baseMove === 'S') dir = -1;
        
        if (['X','Y','Z'].includes(baseMove)) {
            axis = baseMove.toLowerCase();
            if (baseMove === 'X') dir = -1;
            if (baseMove === 'Y') dir = -1;
            if (baseMove === 'Z') dir = -1;
        }

        if (isPrime) dir *= -1;
        
        let angle = (Math.PI / 2) * dir;
        if (isDouble) angle *= 2;
        
        return { axis, angle, isWholeCube: ['X','Y','Z'].includes(baseMove) };
    }

    function getCubiesForMove(move) {
        let baseMove = move.replace('2', '').replace('i', '');
        let axis, value;
        if (baseMove === 'R') { axis = 'x'; value = 1; }
        else if (baseMove === 'L') { axis = 'x'; value = -1; }
        else if (baseMove === 'M') { axis = 'x'; value = 0; }
        else if (baseMove === 'U') { axis = 'y'; value = 1; }
        else if (baseMove === 'D') { axis = 'y'; value = -1; }
        else if (baseMove === 'E') { axis = 'y'; value = 0; }
        else if (baseMove === 'F') { axis = 'z'; value = 1; }
        else if (baseMove === 'B') { axis = 'z'; value = -1; }
        else if (baseMove === 'S') { axis = 'z'; value = 0; }
        else return cubies; 
        
        let target = value * gap;
        return cubies.filter(c => Math.abs(c.position[axis] - target) < 0.1);
    }

    function animateMove(moveStr, duration, onComplete) {
        isAnimatingMove = true;
        let { axis, angle, isWholeCube } = getMoveParams(moveStr);
        let sliceCubies = isWholeCube ? cubies : getCubiesForMove(moveStr);
        
        let sliceStickers = [];
        sliceCubies.forEach(cubie => {
            cubie.children.forEach(child => {
                if (child.userData && child.userData.face) {
                    sliceStickers.push(child);
                }
            });
        });

        sliceStickers.forEach(s => s.material.emissive.setHex(0x333333));
        
        let highlightDelay = 200 / animationSpeed;
        let animDuration = duration / animationSpeed;

        setTimeout(() => {
            sliceCubies.forEach(c => pivot.attach(c));
            
            let progress = 0;
            function loop() {
                progress += 16 / animDuration;
                if (progress > 1) progress = 1;
                
                let ease = 1 - Math.pow(1 - progress, 3);
                pivot.rotation[axis] = angle * ease;
                
                if (progress < 1) {
                    requestAnimationFrame(loop);
                } else {
                    sliceCubies.forEach(c => cubeGroup.attach(c));
                    pivot.rotation.set(0,0,0);
                    
                    sliceCubies.forEach(c => {
                        c.position.x = Math.round(c.position.x / gap) * gap;
                        c.position.y = Math.round(c.position.y / gap) * gap;
                        c.position.z = Math.round(c.position.z / gap) * gap;
                    });
                    
                    sliceStickers.forEach(s => s.material.emissive.setHex(0x000000));
                    
                    isAnimatingMove = false;
                    if (onComplete) onComplete();
                }
            }
            loop();
        }, highlightDelay);
    }

    function playNext() {
        if (currentMoveIdx >= solutionMoves.length) {
            isPlaying = false;
            document.getElementById('play-pause-btn').innerText = 'Play';
            return;
        }
        
        let move = solutionMoves[currentMoveIdx];
        document.getElementById('current-move-text').innerText = `${move} (${currentMoveIdx + 1}/${solutionMoves.length})`;
        
        animateMove(move, 450, () => {
            currentMoveIdx++;
            if (isPlaying) playTimeout = setTimeout(playNext, 150 / animationSpeed);
        });
    }

    document.getElementById('play-pause-btn').addEventListener('click', (e) => {
        if (currentMoveIdx >= solutionMoves.length) return;
        isPlaying = !isPlaying;
        e.target.innerText = isPlaying ? 'Pause' : 'Play';
        if (isPlaying) playNext();
        else clearTimeout(playTimeout);
    });

    document.getElementById('next-move-btn').addEventListener('click', () => {
        if (isAnimatingMove || currentMoveIdx >= solutionMoves.length) return;
        isPlaying = false;
        document.getElementById('play-pause-btn').innerText = 'Play';
        playNext();
    });

    document.getElementById('prev-move-btn').addEventListener('click', () => {
        if (isAnimatingMove || currentMoveIdx <= 0) return;
        isPlaying = false;
        document.getElementById('play-pause-btn').innerText = 'Play';
        clearTimeout(playTimeout);
        
        currentMoveIdx--;
        let move = solutionMoves[currentMoveIdx];
        let inverseMove = move.includes('i') ? move.replace('i', '') : (move.includes('2') ? move : move + 'i');
        
        document.getElementById('current-move-text').innerText = `Undoing ${move}`;
        
        animateMove(inverseMove, 450, () => {
            document.getElementById('current-move-text').innerText = `Reverted (${currentMoveIdx}/${solutionMoves.length})`;
        });
    });

    // Camera Snapping
    const snapTargets = {
        'U': { x: 0.01, y: 10, z: 0 }, // slight x offset avoids gimbal lock when looking straight up/down
        'D': { x: 0.01, y: -10, z: 0 },
        'F': { x: 0, y: 0, z: 10 },
        'B': { x: 0, y: 0, z: -10 },
        'L': { x: -10, y: 0, z: 0 },
        'R': { x: 10, y: 0, z: 0 }
    };

    let cameraAnimFrame = null;
    document.querySelectorAll('.snap-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const face = btn.dataset.face;
            if (!snapTargets[face]) return;
            
            const targetPos = snapTargets[face];
            const startPos = camera.position.clone();
            
            if (cameraAnimFrame) cancelAnimationFrame(cameraAnimFrame);
            
            let p = 0;
            function animateCamera() {
                p += 0.04; // Adjust speed here
                if (p > 1) p = 1;
                
                // Ease out cubic
                const ease = 1 - Math.pow(1 - p, 3);
                
                camera.position.x = startPos.x + (targetPos.x - startPos.x) * ease;
                camera.position.y = startPos.y + (targetPos.y - startPos.y) * ease;
                camera.position.z = startPos.z + (targetPos.z - startPos.z) * ease;
                
                // Smoothly snap target (lookAt point) back to center (0,0,0)
                controls.target.x = controls.target.x * (1 - ease);
                controls.target.y = controls.target.y * (1 - ease);
                controls.target.z = controls.target.z * (1 - ease);
                
                if (p < 1) {
                    cameraAnimFrame = requestAnimationFrame(animateCamera);
                }
            }
            animateCamera();
        });
    });

    // Render Loop
    function render() {
        requestAnimationFrame(render);
        controls.update();
        renderer.render(scene, camera);
    }
    render();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
});

// ============ MOBILE DRAWER LOGIC ============
let mobileDrawerOpen = false;

function toggleMobileDrawer() {
    mobileDrawerOpen = !mobileDrawerOpen;
    const drawer = document.getElementById('mobile-drawer');
    const toggle = document.getElementById('mobile-toggle');
    const label = document.getElementById('mobile-toggle-label');
    drawer.classList.toggle('open', mobileDrawerOpen);
    toggle.classList.toggle('open', mobileDrawerOpen);
    label.textContent = mobileDrawerOpen ? 'Close' : 'Paint Colors';
}

// Sync drawer color buttons with main JS activeColor
document.addEventListener('DOMContentLoaded', () => {
    const drawerBtns = document.querySelectorAll('.drawer-color-btn');
    const mainBtns = document.querySelectorAll('.color-btn');

    drawerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Activate in drawer
            drawerBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Mirror to the main sidebar buttons (which drive activeColor in main.js)
            const color = btn.dataset.color;
            mainBtns.forEach(b => {
                b.classList.toggle('active', b.dataset.color === color);
                if (b.dataset.color === color) b.click();
            });

            // Close drawer after picking so cube is fully visible
            toggleMobileDrawer();
        });
    });

    // Mobile solve button mirrors the desktop one
    const mobileSolveBtn = document.getElementById('mobile-solve-btn');
    const desktopSolveBtn = document.getElementById('trigger-solve-btn');
    mobileSolveBtn.addEventListener('click', () => {
        desktopSolveBtn.click();
        // Only close the drawer if we actually started solving
        if (mobileSolveBtn.classList.contains('ready')) {
            toggleMobileDrawer();
        }
    });

    // Mobile reset button
    document.getElementById('mobile-reset-paint-btn').addEventListener('click', () => {
        if (window._resetPainting) window._resetPainting();
        toggleMobileDrawer();
    });

    // Keep mobile progress in sync with desktop progress
    const observer = new MutationObserver(() => {
        const count = document.getElementById('painted-count').textContent.split('/')[0];
        document.getElementById('mobile-painted-count').textContent = count;
        const fill = document.getElementById('progress-bar-fill').style.width;
        document.getElementById('mobile-progress-fill').style.width = fill;
        // Mirror solve button state
        mobileSolveBtn.classList.toggle('ready', desktopSolveBtn.classList.contains('ready'));
    });
    observer.observe(document.getElementById('painted-count'), { childList: true, characterData: true, subtree: true });
    observer.observe(document.getElementById('progress-bar-fill'), { attributes: true, attributeFilter: ['style'] });

    // Cool Patterns Logic
    function applyPattern(patternMoves) {
        // First fill the cube completely (solved state)
        stickers.forEach(sticker => {
            const f = sticker.userData.face;
            const centerC = getCenterColor(f);
            sticker.userData.color = centerC;
            sticker.material.color.setHex(hexColors[centerC]);
            sticker.material.emissive.setHex(0x000000);
            cubeState[f][sticker.userData.index] = centerC;
        });
        
        colorCounts = { 'W': 9, 'Y': 9, 'G': 9, 'B': 9, 'O': 9, 'R': 9 };
        updatePaintedCount();
        
        // Start solving animation sequence backwards? Or just animate the moves
        isSolvingTriggered = true;
        let solutionStr = patternMoves.replace(/'/g, "i");
        handleSolveSuccess(solutionStr);
        
        document.getElementById('current-move-text').innerText = "Pattern Ready";
    }

    document.querySelectorAll('.pattern-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (isSolvingTriggered || isAnimatingMove) return;
            applyPattern(btn.dataset.pattern);
            if (mobileDrawerOpen) toggleMobileDrawer();
        });
    });
});
