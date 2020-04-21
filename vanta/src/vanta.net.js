/*Modified by Alex Kotlar 2020*/

import VantaBase, { VANTA } from './_base.js'
import { rn, ri, getBrightness } from './helpers.js'

const win = typeof window == 'object'
let THREE = win && window.THREE

class Effect extends VantaBase {
  static initClass() {
    this.prototype.defaultOptions = {
      color: 0xff3f81,
      backgroundColor: 0xfffffff,
      points: 10,
      maxDistance: 20,
      spacing: 15,
      showDots: true
    }
    this.prototype.mouse = { "x": 0, "y": 0, "rawY": 0, "updated": false, "updatedCount": -1, "ran": false };
  }

  constructor(userOptions) {
    THREE = userOptions.THREE || THREE
    super(userOptions)

    this.cachedColor = new THREE.Color(0x000000);
    this.cachedZeroVector = new THREE.Vector3(0, 0, 0);
    this.diffColor = this.options.color.clone().sub(this.options.backgroundColor);
    this.colorB = getBrightness(new THREE.Color(this.options.color))
    this.bgB = getBrightness(new THREE.Color(this.options.backgroundColor));

    this.elOffset = this.el.offsetTop;
    console.info('this.elOffset', this.elOffset);
    let timeout;
    window.addEventListener('mousemove', (e) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = setTimeout(() => {
        this.onMouseMove2(e)
        timeout = null;
      }, 4)
    }, false);
  }

  // TODO: need to dot his r elative t o t he #hero container
  onMouseMove2(e) {
    if (!this.elOnscreen) {
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
      this.mouse.updatedCount = -1;

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
        // transparent: true,
        // opacity: .125
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
    this.scene.add(this.cont)

    let n = this.options.points
    let { spacing } = this.options

    const numPoints = n * n * 2;
    this.linePositions = new Float32Array(numPoints * numPoints * 3)
    this.lineColors = new Float32Array(numPoints * numPoints * 3)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(this.linePositions, 3).setUsage(THREE.DynamicDrawUsage))
    geometry.setAttribute('color', new THREE.BufferAttribute(this.lineColors, 3).setUsage(THREE.DynamicDrawUsage))
    // geometry.computeBoundingSphere()
    geometry.setDrawRange(0, 0)
    const material = new THREE.LineBasicMaterial({
      vertexColors: THREE.VertexColors,
      // blending: THREE.AdditiveBlending,
      transparent: true,
      alphaTest: .1,
      // opacity: .125
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
      .01, 10000)
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

      if (this.rayCaster && this.mouse.updated) {
        distToMouse = (12 - this.rayCaster.ray.distanceToPoint(p.position)) * 0.25;
        if (distToMouse > 1) {
          affected1 = 1;
          //p.scale.x = p.scale.y = p.scale.z = 2;
        } else {
          affected1 = 0;
          // p.scale.x = p.scale.y = p.scale.z = distToMouse;
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
        if (affected1) {
          console.info("affected");
        }
        const p2 = this.points[j]
        const dx = p.position.x - p2.position.x
        const dy = p.position.y - p2.position.y
        const dz = p.position.z - p2.position.z
        dist = Math.sqrt((dx * dx) + (dy * dy) + (dz * dz))
        if (dist < this.options.maxDistance) {

          let alpha = ((1.0 - (dist / this.options.maxDistance)) * 2);
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
          // if @blending == 'subtractive'
          //   lineColor = new THREE.Color(0x000000).lerp(diffColor, alpha)

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
    // this.mouse.updated = false;
    if (this.mouse.updated || this.mouse.updatedCount >= 0) {
      this.mouse.updatedCount += 1;
      if (this.mouse.updatedCount % 72 == 0) {
        this.mouse.updated = true;
      } else {
        this.mouse.updated = false;
      }
    }

    this.linesMesh.geometry.setDrawRange(0, numConnected * 2)
    this.linesMesh.geometry.attributes.position.needsUpdate = true
    this.linesMesh.geometry.attributes.color.needsUpdate = true
  }
}
Effect.initClass()

export default VANTA.register('NET', Effect)