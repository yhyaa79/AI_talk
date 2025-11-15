/* // Three.js برای ذرات سه‌بعدی
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);

camera.position.z = 50;

// ایجاد ذرات
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 4000;
const posArray = new Float32Array(particlesCount * 3); 
const colors = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i += 3) {
    posArray[i] = (Math.random() - 0.5) * 100;
    posArray[i + 1] = (Math.random() - 0.5) * 100;
    posArray[i + 2] = (Math.random() - 0.5) * 100;

    colors[i] = Math.random() > 0.5 ? 0 : 1;
    colors[i + 1] = Math.random() * 0.5;
    colors[i + 2] = 1;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

// --- بخش جدید: ایجاد تکسچر دایره‌ای ---
const canvasTexture = document.createElement('canvas');
canvasTexture.width = 64;  // اندازه canvas (بزرگ‌تر = کیفیت بهتر، اما سنگین‌تر)
canvasTexture.height = 64;
const ctx = canvasTexture.getContext('2d');

// رسم دایره با گرادیان برای لبه‌های نرم (اختیاری، برای زیبایی بیشتر)
const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

ctx.fillStyle = gradient;
ctx.beginPath();
ctx.arc(32, 32, 32, 0, Math.PI * 2);
ctx.fill();

const texture = new THREE.CanvasTexture(canvasTexture);
texture.needsUpdate = true;  // برای به‌روزرسانی texture

// --- انتهای بخش جدید ---

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.3,
    map: texture,  // --- تغییر اصلی: اضافه کردن تکسچر دایره‌ای ---
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// انیمیشن
function animate() {
    requestAnimationFrame(animate);
    particles.rotation.y += 0.002;
    particles.rotation.x += 0.001;
    renderer.render(scene, camera);
}
animate();

// ریسپانسیو کردن
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// تعامل با ماوس
document.addEventListener('mousemove', (event) => {
    const container = document.getElementById('container');
    const actionButtons = document.getElementById('actionButtons');
    // فقط وقتی اجرا بشه که ماوس خارج از هر دو المنت باشه
    if (!container.contains(event.target) && !actionButtons.contains(event.target)) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        particles.rotation.y = mouseX * 0.25;
        particles.rotation.x = mouseY * 0.25;
    }
});

 */


/* // Three.js برای ذرات سه‌بعدی
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);

camera.position.z = 50;

// ایجاد ذرات
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2500;
const posArray = new Float32Array(particlesCount * 3);
const colors = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i += 3) {
    posArray[i] = (Math.random() - 0.5) * 100;
    posArray[i + 1] = (Math.random() - 0.5) * 100;
    posArray[i + 2] = (Math.random() - 0.5) * 100;

    colors[i] = Math.random() > 0.5 ? 0 : 1;
    colors[i + 1] = Math.random() * 0.5;
    colors[i + 2] = 1;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// انیمیشن
function animate() {
    requestAnimationFrame(animate);
    particles.rotation.y += 0.002;
    particles.rotation.x += 0.001;
    renderer.render(scene, camera);
}
animate();

// ریسپانسیو کردن
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// تعامل با ماوس
document.addEventListener('mousemove', (event) => {
    const container = document.getElementById('container');
    const actionButtons = document.getElementById('actionButtons');
    // فقط وقتی اجرا بشه که ماوس خارج از هر دو المنت باشه
    if (!container.contains(event.target) && !actionButtons.contains(event.target)) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        particles.rotation.y = mouseX * 0.2;
        particles.rotation.x = mouseY * 0.2;
    }
}); */


// Three.js برای ذرات سه‌بعدی
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('canvas'),
    alpha: true
});
renderer.setSize(window.innerWidth, window.innerHeight);

// تنظیم استایل canvas برای قرارگیری پشت container (به عنوان background)
const canvas = document.getElementById('canvas');
canvas.style.position = 'fixed';
canvas.style.top = '0';
canvas.style.left = '0';
canvas.style.zIndex = '-1';
canvas.style.pointerEvents = 'none'; // جلوگیری از تداخل ماوس با canvas

// تنظیم استایل container برای قرارگیری روی canvas
const mainContainer = document.getElementById('container');
if (mainContainer) {
    mainContainer.style.position = 'relative';
    mainContainer.style.zIndex = '1';
}

camera.position.z = 50;

// ایجاد ذرات
const particlesGeometry = new THREE.BufferGeometry();
const particlesCount = 2500;
const posArray = new Float32Array(particlesCount * 3);
const colors = new Float32Array(particlesCount * 3);

for (let i = 0; i < particlesCount * 3; i += 3) {
    posArray[i] = (Math.random() - 0.5) * 100;
    posArray[i + 1] = (Math.random() - 0.5) * 100;
    posArray[i + 2] = (Math.random() - 0.5) * 100;

    colors[i] = Math.random() > 0.5 ? 0 : 1;
    colors[i + 1] = Math.random() * 0.5;
    colors[i + 2] = 1;
}

particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const particlesMaterial = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
});

const particles = new THREE.Points(particlesGeometry, particlesMaterial);
scene.add(particles);

// انیمیشن
function animate() {
    requestAnimationFrame(animate);
    particles.rotation.y += 0.002;
    particles.rotation.x += 0.001;
    renderer.render(scene, camera);
}
animate();

// ریسپانسیو کردن
window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// تعامل با ماوس
document.addEventListener('mousemove', (event) => {
    const actionButtons = document.getElementById('actionButtons');
    // فقط وقتی اجرا بشه که ماوس خارج از هر دو المنت باشه
    if (mainContainer && !mainContainer.contains(event.target) && !actionButtons.contains(event.target)) {
        const mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        const mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
        particles.rotation.y = mouseX * 0.2;
        particles.rotation.x = mouseY * 0.2;
    }
});