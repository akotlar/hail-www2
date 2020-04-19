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

    this.options =  Object.assign({
      mouseControls: true,
      touchControls: true,
      minHeight: 200,
      minWidth: 200,
      scale: 1,
      scaleMobile: 1
    }, this.defaultOptions || {}, userOptions);
    
    this.el = this.options.el
    if (this.el == null) {
      error("Instance needs \"el\" param!")
    } else if (!(this.options.el instanceof HTMLElement)) {
      const selector = this.el
      this.el = document.querySelector(selector)
      if (!this.el) {
        error("Cannot find element", selector)
        return
      }
    }

    this.prepareEl()
    this.initThree()
    this.setSize()

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

    this.resize()
    this.animationLoop()

    window.addEventListener('resize', this.resize)
    window.requestAnimationFrame(() => this.resize(true)) // Force a resize after the first frame
    window.addEventListener('scroll', scrollingListener);

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
    canvasEl.id = 'vanta-canvas';
  }

  initThree() {
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
      this.applyCanvasStyles(this.renderer.domElement)
      if (isNaN(this.options.backgroundAlpha)) {
        this.options.backgroundAlpha = 1
      }
      this.scene = new THREE.Scene()
  }

  getCanvasElement() {
    if (this.renderer) {
      return this.renderer.domElement
    }
    if (this.p5renderer) {
      return this.p5renderer.canvas
    }
  }

  setSize() {
    this.scale || (this.scale = 1)
    if (mobileCheck() && this.options.scaleMobile) {
      this.scale = this.options.scaleMobile
    } else if (this.options.scale) {
      this.scale = this.options.scale
    }
    this.width = Math.max(this.el.offsetWidth, this.options.minWidth)
    this.height = Math.max(this.el.offsetHeight, this.options.minHeight)
  }


  resize() {
    this.setSize()
    if (this.camera) {
      this.camera.aspect = this.width / this.height
      if (typeof this.camera.updateProjectionMatrix === "function") {
        this.camera.updateProjectionMatrix()
      }
    }
    if (this.renderer) {
      this.renderer.setSize(this.width, this.height)
      this.renderer.setPixelRatio(window.devicePixelRatio / this.scale)
    }
    typeof this.onResize === "function" ? this.onResize() : void 0
  }

  // TOOD: fix this by using intersection observer
  isOnScreen() {
    const elHeight = this.el.offsetHeight
    const elRect = this.el.getBoundingClientRect()
    const scrollTop = (window.pageYOffset ||
      (document.documentElement || document.body.parentNode || document.body).scrollTop
    )
    const offsetTop = elRect.top + scrollTop
    const minScrollTop = offsetTop - window.innerHeight
    const maxScrollTop = offsetTop + elHeight
    return minScrollTop <= scrollTop && scrollTop <= maxScrollTop
  }

  animationLoop() {
    const now = Date.now();
    const delta = now - this.then;

    if (!isScrolling || !this.postInit) {
      if (this.options.forceAnimate || (delta > this.interval && this.isOnScreen())) {
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
    return this.req = window.setTimeout(this.animationLoop, this.postInit ? 24 : 0)
  }

  destroy() {
    if (typeof this.onDestroy === "function") {
      this.onDestroy()
    }
    const rm = window.removeEventListener
    rm('resize', this.resize)
    rm('scroll', scrollingListener);

    window.cancelAnimationFrame(this.req)
    if (this.renderer) {
      if (this.renderer.domElement) {
        this.el.removeChild(this.renderer.domElement)
      }
      this.renderer = null
      this.scene = null
    }
  }
}

export default VANTA.VantaBase