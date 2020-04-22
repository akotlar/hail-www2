/*Modified by Alex Kotlar 2020*/
import { rn, ri, getBrightness } from './helpers.js'

class Viz {
  constructor(userOptions = {}) {
    if (!THREE.WebGLRenderer) {
      console.warn("[VANTA] No THREE defined on window")
      return
    }

    this.options = Object.assign({
      scale: 1,
      scaleMobile: 1,
      color: 0xff3f81,
      backgroundColor: 0xfffffff,
      points: 10,
      maxDistance: 20,
      spacing: 15,
      showDots: true
    }, userOptions);

    this.el = document.querySelector(this.options.el);

    if (!this.el) {
      console.error(`Cannot find ${this.options.el}`)
      return;
    }

    this.mouse = { "x": 0, "y": 0, "rawY": 0, "updated": false, "updatedCount": -1, "ran": false };

    this.highlightColor = new THREE.Color('purple');
    this.cachedColor = new THREE.Color(0x000000);
    this.options.color = new THREE.Color(this.options.color)
    this.options.backgroundColor = new THREE.Color(this.options.backgroundColor)
    this.diffColor = this.options.color.clone().sub(this.options.backgroundColor);
    this.colorB = getBrightness(new THREE.Color(this.options.color))
    this.bgB = getBrightness(new THREE.Color(this.options.backgroundColor));
  
    this.elOffset = this.el.offsetTop;
    this.elOnscreen = false;
    this.isScrolling = false;
    this.resizeTimeout = null;
    this.postInit = false

    this.animationLoop = this.animationLoop.bind(this)

    window.requestAnimationFrame(() => {
      this.renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true
      })

      this.el.appendChild(this.renderer.domElement)

      Object.assign(this.renderer.domElement.style, {
        position: 'absolute',
        zIndex: 0,
        top: 0,
        left: 0,
        background: ''
      });

      this.renderer.domElement.id = 'viz-canvas';
    });

    window.requestAnimationFrame(() => {
      this.scene = new THREE.Scene()
      this.elOnscreen = true;
    })
    
    const intersectionThreshold = 0.6;
    const intersectionCallback = (entries) => {
      if (entries.length > 1) {
        console.error("should be observing a single element");
      }

      // entries[0].isIntersecting incorrect in firefox
      this.elOnscreen = entries[0].intersectionRatio > intersectionThreshold;
      this.interval = 1000 / 16;
      if (this.elOnscreen && this.postInit == false) {
        try {
          window.requestAnimationFrame(() => {
            this.init();
            this.postInit = true;
            this.then = Date.now();
            this.listen();
          });

          window.requestAnimationFrame(() => {
            this.el.style.opacity = "1";
          });
        } catch (e) {
          console.error('Init error', e)
          if (this.renderer && this.renderer.domElement) {
            this.el.removeChild(this.renderer.domElement)
          }
          return
        }
      }
    };

    let observer = new IntersectionObserver(intersectionCallback, { threshold: intersectionThreshold });

    window.requestAnimationFrame(() => observer.observe(this.renderer.domElement));
    window.requestAnimationFrame(() => this.resize(true));
    window.requestAnimationFrame(this.animationLoop);
  }

  listen() {
    this.elOffset = this.el.offsetTop;

    this.isScrolling = false;
    this.resizeTimeout = null;

    window.addEventListener('resize', (e) => this.resize(e))
    window.addEventListener('scroll', () => {
      if (this.isScrolling) {
        window.clearTimeout(this.isScrolling);
      }

      this.isScrolling = setTimeout(() => this.isScrolling = null, 100);
    });

    let timeout;
    window.addEventListener('mousemove', (e) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        this.onMouseMove2(e)
        timeout = null;
      }, this.mouse.dontshow ? 32 : 4);
    }, false);

    this.mouse.dontshow = false;
    const d = document.getElementById('hero-content');
    const n = document.getElementById('hail-navbar');

    d.onmouseover = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      this.mouse.updated = false;
      this.mouse.updatedCount = 0;
      this.mouse.dontshow = true;
    }

    d.onmouseout = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      this.mouse.updated = true;
      this.mouse.updatedCount = 0;
      this.mouse.dontshow = false;
    }

    n.onmouseover = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      this.mouse.updated = false;
      this.mouse.updatedCount = 0;
      this.mouse.dontshow = true;
    }

    n.onmouseout = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      this.mouse.updated = true;
      this.mouse.updatedCount = 0;
      this.mouse.dontshow = false;
    }
  }

  resize(e) {
    if(this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    this.resizeTimeout = setTimeout( () => {
      if (this.camera) {
        this.camera.aspect = this.el.offsetWidth / this.el.offsetHeight
        if (typeof this.camera.updateProjectionMatrix === "function") {
          this.camera.updateProjectionMatrix()
        }
      }
      if (this.renderer) {
        this.renderer.setSize(this.el.offsetWidth, this.el.offsetHeight)
        this.renderer.setPixelRatio(window.devicePixelRatio)
      }

      this.resizeTimeout = null;
    }, this.postInit ? 100: 0);
  }

  animationLoop() {
    const now = Date.now();
    const delta = now - this.then;

    if (this.elOnscreen && (!this.isScrolling || !this.postInit)) {
      if (delta > this.interval) {
        if (typeof this.onUpdate === "function") {
          this.onUpdate()
        }
        if (this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera)
          this.renderer.setClearColor(this.options.backgroundColor, this.options.backgroundAlpha)
        }
        if (this.fps && this.fps.update) this.fps.update()
        if (typeof this.afterRender === "function") this.afterRender()
      }
    }

    this.then = now - (delta % this.interval);
    return this.req = window.setTimeout(this.animationLoop, !this.elOnscreen ? 1000 : (this.postInit ? 24 : 0))
  }


  onMouseMove2(e) {
    if (!this.elOnscreen || this.mouse.dontshow) {
      return;
    }

    if (!this.mouse.ran) {
      this.mouse.ran = true;
      return;
    }

    if (!this.rayCaster) {
      this.rayCaster = new THREE.Raycaster()
    }

    const ox = e.pageX;
    const oy = e.pageY - this.elOffset;
    const x = (ox / this.el.offsetWidth) * 2 - 1;

    const y = - (oy / this.el.offsetHeight) * 2 + 1;

    if (x !== this.mouse.x || y !== this.mouse.y) {
      this.mouse.x = x;
      this.mouse.y = y;
      this.mouse.updated = true;
      this.mouse.updatedCount = 0;

      this.rayCaster.setFromCamera(new THREE.Vector2(this.mouse.x, this.mouse.y), this.camera);
    }
  }

  genPoint(x, y, z) {
    let sphere;
    if (!this.points) { this.points = []; }

    if (this.options.showDots) {
      const geometry = new THREE.SphereGeometry(0.25, 12, 12); // radius, width, height
      const material = new THREE.MeshLambertMaterial({
        color: this.options.color,
        // blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: .2
      });
      sphere = new THREE.Mesh(geometry, material);
      sphere.renderOrder = 1;
    } else {
      sphere = new THREE.Object3D();
    }
    this.cont.add(sphere);
    sphere.ox = x;
    sphere.oy = y;
    sphere.oz = z;
    sphere.position.set(x, y, z);
    sphere.r = rn(-2, 2); // rotation rate
    return this.points.push(sphere);
  }

  init() {
    this.cont = new THREE.Group()
    this.cont.position.set(0, 0, 0)
    this.scene = new THREE.Scene();
    this.scene.add(this.cont)

    let n = this.options.points
    let { spacing } = this.options

    const numPoints = n * n * 2;
    this.linePositions = new Float32Array(numPoints * numPoints * 3)
    this.lineColors = new Float32Array(numPoints * numPoints * 3)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(this.lineColors, 3));
    geometry.computeBoundingSphere()
    geometry.setDrawRange(0, 0)
    const material = new THREE.LineBasicMaterial({
      vertexColors: THREE.VertexColors,
      // blending: THREE.AdditiveBlending,
      transparent: true,
      alphaTest: .1,
      opacity: .2
    })

    this.linesMesh = new THREE.LineSegments(geometry, material)
    this.linesMesh.renderOrder = 2;
    this.cont.add(this.linesMesh)

    for (let i = 0; i <= n; i++) {
      for (let j = 0; j <= n; j++) {
        const y = ri(-3, 3)
        const x = ((i - (n / 2)) * spacing) + ri(-5, 5)
        let z = ((j - (n / 2)) * spacing) + ri(-5, 5)
        if (i % 2) { z += spacing * 0.5 } // offset

        this.genPoint(x, y - ri(5, 15), z)
        this.genPoint(x + ri(-5, 5), y + ri(5, 15), z + ri(-5, 5))
      }
    }

    // PerspectiveCamera( fov, aspect, near, far )
    this.camera = new THREE.PerspectiveCamera(
      25,
      this.el.offsetWidth / (this.el.offsetHeight),
      .01, 10000);

    console.info("camera", this.camera)
    this.camera.position.set(50, 100, 150)
    this.scene.add(this.camera)

    const ambience = new THREE.AmbientLight(0xffffff, 0.75)
    this.scene.add(ambience);
    this.camera.lookAt(0, 0, 0);
  }

  onUpdate() {
    let vertexpos = 0
    let colorpos = 0
    let numConnected = 0

    let dist, distToMouse, lineColor, p
    let affected1 = 0;
    // let affected2 = 0;
    for (let i = 0; i < this.points.length; i++) {
      p = this.points[i]

      if (this.rayCaster) {
        if (this.mouse.updated) {
          distToMouse = (12 - this.rayCaster.ray.distanceToPoint(p.position)) * 0.25;
          if (distToMouse > 1) {
            affected1 = 1;
            p.material.color = this.highlightColor;
          } else {
            affected1 = 0;
            p.material.color = this.options.color;
          }
        }
        else if (p.material.color !== this.options.color) {
          p.material.color = this.options.color;
        }

      }

      if (p.r !== 0) {
        let ang = Math.atan2(p.position.z, p.position.x)
        dist = Math.sqrt((p.position.z * p.position.z) + (p.position.x * p.position.x))
        ang += 0.00025 * p.r
        p.position.x = dist * Math.cos(ang)
        p.position.z = dist * Math.sin(ang)
      }

      for (let j = i; j < this.points.length; j++) {

        const p2 = this.points[j]
        dist = Math.sqrt(((p.position.x - p2.position.x) ** 2) + ((p.position.y - p2.position.y) ** 2) + ((p.position.z - p2.position.z) ** 2))
        if (dist < this.options.maxDistance) {
          if (affected1) {
            lineColor = this.highlightColor;
          } else {
            let alpha = ((1.0 - (dist / this.options.maxDistance)));
            if (alpha < 0) {
              alpha = 0
            } else if (alpha > 1) {
              alpha = 1;
            }

            if (this.blending === 'additive') {
              lineColor = this.cachedColor.clone().lerp(this.diffColor, alpha)
            } else {
              lineColor = this.options.backgroundColor.clone().lerp(this.options.color, alpha)
            }
          }
          this.linePositions[vertexpos++] = p.position.x
          this.linePositions[vertexpos++] = p.position.y
          this.linePositions[vertexpos++] = p.position.z
          this.linePositions[vertexpos++] = p2.position.x
          this.linePositions[vertexpos++] = p2.position.y
          this.linePositions[vertexpos++] = p2.position.z


          this.lineColors[colorpos++] = lineColor.r
          this.lineColors[colorpos++] = lineColor.g
          this.lineColors[colorpos++] = lineColor.b
          this.lineColors[colorpos++] = lineColor.r
          this.lineColors[colorpos++] = lineColor.g
          this.lineColors[colorpos++] = lineColor.b

          numConnected++
        }
      }
    }

    this.linesMesh.geometry.setDrawRange(0, numConnected * 2)
    this.linesMesh.geometry.attributes.position.needsUpdate = true
    this.linesMesh.geometry.attributes.color.needsUpdate = true
  }
}

export default Viz;