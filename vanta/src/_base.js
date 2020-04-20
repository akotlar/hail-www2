/*Modified by Alex Kotlar 2020*/

import { mobileCheck } from './helpers.js'

const win = typeof window == 'object'
let THREE = (win && window.THREE) || {}
if (win && !window.VANTA) window.VANTA = {}
const VANTA = (win && window.VANTA) || {}
VANTA.register = (name, Effect) => {
  return VANTA[name] = (opts) => new Effect(opts)
}
VANTA.version = '0.5.15'

export { VANTA }

// Namespace for errors
const error = function () {
  Array.prototype.unshift.call(arguments, '[VANTA]')
  return console.error.apply(this, arguments)
}

let isScrolling;

const scrollingListener = () => {
  window.clearTimeout(isScrolling);
  isScrolling = setTimeout(function () {
    isScrolling = null;
  }, 100);
}

VANTA.VantaBase = class VantaBase {
  constructor(userOptions = {}) {
    if (!win) return false
    VANTA.current = this
    this.resizeTimeout = null;
    this.resize = this.resize.bind(this)
    this.animationLoop = this.animationLoop.bind(this)

    this.options = Object.assign({
      scale: 1,
      scaleMobile: 1
    }, this.defaultOptions || {}, userOptions);

    this.el = document.querySelector(this.options.el);
    if (!this.el) {
      console.fatal(`Cannot find ${this.options.el}`)
      return;
    }

    this.elOnscreen = false;

    this.prepareEl();

    if (!THREE.WebGLRenderer) {
      console.warn("[VANTA] No THREE defined on window")
      return
    }
    // Set renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true
    })

    this.el.appendChild(this.renderer.domElement)

    this.renderer.domElement.id = 'vanta-canvas';

    this.applyCanvasStyles(this.renderer.domElement)
    this.scene = new THREE.Scene()
    this.elOnscreen = true;

    const intersectionThreshold = 0.25;
    const intersectionCallback = (entries) => {
      if (entries.length > 1) {
        console.error("should be observing a single element");
      }

      // entries[0].isIntersecting incorrect in firefox
      this.elOnscreen = entries[0].intersectionRatio > intersectionThreshold;
    };

    let observer = new IntersectionObserver(intersectionCallback, { threshold: intersectionThreshold });
    let target = document.getElementById('vanta-canvas');
    observer.observe(target);

    try {
      this.init()
    } catch (e) {
      error('Init error', e)
      if (this.renderer && this.renderer.domElement) {
        this.el.removeChild(this.renderer.domElement)
      }
      return
    }

    this.options.color = new THREE.Color(this.options.color)
    this.options.backgroundColor = new THREE.Color(this.options.backgroundColor)
    this.then = Date.now();
    this.interval = 1000 / 16;
    this.postInit = false

    window.addEventListener('resize', this.resize)
    window.addEventListener('scroll', scrollingListener);
    window.requestAnimationFrame(() => this.resize(true))
    window.requestAnimationFrame(() => this.animationLoop())

    this.postInit = true;
  }

  prepareEl() {
    let i, child
    // wrapInner for text nodes
    if (typeof Node !== 'undefined' && Node.TEXT_NODE) {
      for (i = 0; i < this.el.childNodes.length; i++) {
        const n = this.el.childNodes[i]
        if (n.nodeType === Node.TEXT_NODE) {
          const s = document.createElement('span')
          s.textContent = n.textContent
          n.parentElement.insertBefore(s, n)
          n.remove()
        }
      }
    }
    // Set foreground elements
    for (i = 0; i < this.el.children.length; i++) {
      child = this.el.children[i]
      if (getComputedStyle(child).position === 'static') {
        child.style.position = 'relative'
      }
      if (getComputedStyle(child).zIndex === 'auto') {
        child.style.zIndex = 1
      }
    }
    // Set canvas and container style
    if (getComputedStyle(this.el).position === 'static') {
      this.el.style.position = 'relative'
    }
  }

  applyCanvasStyles(canvasEl, opts = {}) {
    Object.assign(canvasEl.style, {
      position: 'absolute',
      zIndex: 0,
      top: 0,
      left: 0,
      background: ''
    });
    Object.assign(canvasEl.style, opts);
  }

  getCanvasElement() {
    if (this.renderer) {
      return this.renderer.domElement
    }
    if (this.p5renderer) {
      return this.p5renderer.canvas
    }
  }

  resize() {
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
  }

  animationLoop() {
    const now = Date.now();
    const delta = now - this.then;

    if (this.elOnscreen && (!isScrolling || !this.postInit)) {
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
}

export default VANTA.VantaBase