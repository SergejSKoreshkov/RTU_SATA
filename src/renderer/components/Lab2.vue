<template>
    <div class="lab2">
        <div class="overlay-dark" v-show="loading">
            <div class="spinner-border" role="status">
                <span class="sr-only">Loading...</span>
            </div>
        </div>
        <div class="row">
            <div class="col-4">
                <h4>Click to add image</h4>
                <canvas class="hover"
                    @click="openImage"
                    @mousemove="showInfo"
                    @mouseout="clearInfo"
                    ref="canvasMain"
                    width="200"
                    height="100"
                ></canvas>
                <button
                    :class="`btn ${selectedColorSystem === 'RGB' ? 'btn-primary' : 'btn-secondary'}`"
                    @click="convertToRGB">RGB</button>
                <button
                    :class="`btn ${selectedColorSystem === 'LAB' ? 'btn-primary' : 'btn-secondary'}`"
                    @click="convertToLAB">LAB</button>
            </div>
            <div class="col-8">
                <h4>Color System: {{ selectedColorSystem || 'Not selected' }}</h4>
                <div class="row" v-show="selectedColorSystem">
                    <div :class="selectedColorSystem === 'RGB' ? 'col-6' : 'col-4'">
                        <canvas ref="canvasComponent1" width="200" height="100"></canvas>
                        <h5>{{ (selectedColorSystem === 'RGB' ? 'R: ' : 'L: ') + component1}}</h5>
                    </div>
                    <div :class="selectedColorSystem === 'RGB' ? 'col-6' : 'col-4'">
                        <canvas ref="canvasComponent2" width="200" height="100"></canvas>
                        <h5>{{ (selectedColorSystem === 'RGB' ? 'G: ' : 'A: ') + component2}}</h5>
                    </div>
                    <div :class="selectedColorSystem === 'RGB' ? 'col-6' : 'col-4'">
                        <canvas ref="canvasComponent3" width="200" height="100"></canvas>
                        <h5>{{ (selectedColorSystem === 'RGB' ? 'B: ' : 'B: ') + component3}}</h5>
                    </div>
                    <div class="col-6" v-show="selectedColorSystem === 'RGB'">
                        <canvas ref="canvasComponent4" width="200" height="100"></canvas>
                        <h5>I: {{component4}}</h5>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
const Jimp = require('jimp')
const { dialog } = require('electron').remote
const mathjs = require('mathjs')

let CONTEXT_WEAKMAP = null
let MAIN_IMAGE_BUFFER = null
let MAIN_IMAGE_BUFFER_LAB = null
let LAST_COMPONENT1_BUFFER = null
let LAST_COMPONENT2_BUFFER = null
let LAST_COMPONENT3_BUFFER = null
let LAST_COMPONENT4_BUFFER = null

const M_MATRIX = mathjs.matrix([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750], [0.0193339, 0.1191920, 0.9503041]])
const E = 0.008856
const K = 903.3
const Xw = 0.95047
const Yw = 1.0
const Zw = 1.08883

const Fx = (x) => {
  const xw = x / Xw
  if (xw > E) return Math.pow(xw, 1.0 / 3.0)
  else return (K * xw + 16.0) / 116.0
}

const Fy = (y) => {
  const yw = y / Yw
  if (yw > E) return Math.pow(yw, 1.0 / 3.0)
  else return (K * yw + 16.0) / 116.0
}

const Fz = (z) => {
  const zw = z / Zw
  if (zw > E) return Math.pow(zw, 1.0 / 3.0)
  else return (K * zw + 16.0) / 116.0
}

export default {
  name: 'lab2',
  data () {
    return {
      selectedColorSystem: '',
      loading: false,
      component1: '0',
      component2: '0',
      component3: '0',
      component4: '0'
    }
  },
  mounted () {
    CONTEXT_WEAKMAP = new WeakMap()
    CONTEXT_WEAKMAP.set(this.$refs.canvasMain, this.$refs.canvasMain.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasComponent1, this.$refs.canvasComponent1.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasComponent2, this.$refs.canvasComponent2.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasComponent3, this.$refs.canvasComponent3.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasComponent4, this.$refs.canvasComponent4.getContext('2d'))
  },
  methods: {
    showInfo (event) {
      if (!MAIN_IMAGE_BUFFER) return
      const { width, height } = event.target
      const size = event.target.getBoundingClientRect()
      const x = parseInt((event.clientX - size.left) / size.width * width)
      const y = parseInt((event.clientY - size.top) / size.height * height)
      const pixelCoordinates = parseInt(width * y + x)

      const ctxComponent1 = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent1)
      const ctxComponent2 = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent2)
      const ctxComponent3 = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent3)
      const ctxComponent4 = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent4)

      if (LAST_COMPONENT1_BUFFER) ctxComponent1.putImageData(LAST_COMPONENT1_BUFFER, 0, 0)
      if (LAST_COMPONENT2_BUFFER) ctxComponent2.putImageData(LAST_COMPONENT2_BUFFER, 0, 0)
      if (LAST_COMPONENT3_BUFFER) ctxComponent3.putImageData(LAST_COMPONENT3_BUFFER, 0, 0)
      if (LAST_COMPONENT4_BUFFER) ctxComponent4.putImageData(LAST_COMPONENT4_BUFFER, 0, 0)

      this.drawLine(ctxComponent1, x, y, width, height)
      this.drawLine(ctxComponent2, x, y, width, height)
      this.drawLine(ctxComponent3, x, y, width, height)
      this.drawLine(ctxComponent4, x, y, width, height)

      if (this.selectedColorSystem === 'RGB') {
        const r = MAIN_IMAGE_BUFFER.r[pixelCoordinates]
        const g = MAIN_IMAGE_BUFFER.g[pixelCoordinates]
        const b = MAIN_IMAGE_BUFFER.b[pixelCoordinates]
        const i = MAIN_IMAGE_BUFFER.i[pixelCoordinates]

        this.component1 = r
        this.component2 = g
        this.component3 = b
        this.component4 = i
      } else if (this.selectedColorSystem === 'LAB') {
        const l = MAIN_IMAGE_BUFFER_LAB.l[pixelCoordinates]
        const a = MAIN_IMAGE_BUFFER_LAB.a[pixelCoordinates]
        const b = MAIN_IMAGE_BUFFER_LAB.b[pixelCoordinates]

        this.component1 = l
        this.component2 = a
        this.component3 = b
      }
    },
    clearInfo () {
      this.component1 = '0'
      this.component2 = '0'
      this.component3 = '0'
      this.component4 = '0'

      const ctxComponent1 = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent1)
      const ctxComponent2 = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent2)
      const ctxComponent3 = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent3)
      const ctxComponent4 = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent4)

      if (LAST_COMPONENT1_BUFFER) ctxComponent1.putImageData(LAST_COMPONENT1_BUFFER, 0, 0)
      if (LAST_COMPONENT2_BUFFER) ctxComponent2.putImageData(LAST_COMPONENT2_BUFFER, 0, 0)
      if (LAST_COMPONENT3_BUFFER) ctxComponent3.putImageData(LAST_COMPONENT3_BUFFER, 0, 0)
      if (LAST_COMPONENT4_BUFFER) ctxComponent4.putImageData(LAST_COMPONENT4_BUFFER, 0, 0)
    },
    drawLine (context, x, y, width, height) {
      context.beginPath()
      context.strokeStyle = '#FF00FF'
      context.lineWidth = 5
      context.moveTo(0, y)
      context.lineTo(width, y)
      context.moveTo(x, 0)
      context.lineTo(x, height)
      context.stroke()
    },

    convertToLAB () {
      this.loading = true
      LAST_COMPONENT1_BUFFER = null
      LAST_COMPONENT2_BUFFER = null
      LAST_COMPONENT3_BUFFER = null
      LAST_COMPONENT4_BUFFER = null
      setTimeout(() => {
        this.selectedColorSystem = 'LAB'
        const { width, height } = this.$refs.canvasMain

        const ctxMain = CONTEXT_WEAKMAP.get(this.$refs.canvasMain)
        const ctxL = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent1)
        const ctxA = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent2)
        const ctxB = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent3)

        if (!ctxMain || !ctxL || !ctxA || !ctxB) return

        const bufferMain = ctxMain.getImageData(0, 0, width, height)
        const bufferL = ctxMain.getImageData(0, 0, width, height)
        const bufferA = ctxMain.getImageData(0, 0, width, height)
        const bufferB = ctxMain.getImageData(0, 0, width, height)

        const labBuffer = {
          l: [],
          a: [],
          b: []
        }

        for (let i = 0; i < bufferMain.data.length; i += 4) {
          const x = Math.pow(bufferMain.data[i] / 255.0, 2.2)
          const y = Math.pow(bufferMain.data[i + 1] / 255.0, 2.2)
          const z = Math.pow(bufferMain.data[i + 2] / 255.0, 2.2)

          const result = mathjs.multiply(M_MATRIX, mathjs.matrix([[x], [y], [z]]))._data

          const L = 116 * Fx(result[0][0]) - 16
          const A = 500 * (Fx(result[0][0]) - Fy(result[1][0]))
          const B = 200 * (Fy(result[1][0]) - Fz(result[2][0]))

          labBuffer.l.push(L)
          labBuffer.a.push(A)
          labBuffer.b.push(B)

          const l = L * 255 / 100
          bufferL.data[i] = l
          bufferL.data[i + 1] = l
          bufferL.data[i + 2] = l
          bufferL.data[i + 3] = 255

          const aKoef = (A * 128 / 100)
          bufferA.data[i] = 128 + aKoef
          bufferA.data[i + 1] = 128 - aKoef
          bufferA.data[i + 2] = 128 + aKoef
          bufferA.data[i + 3] = 255

          const bKoef = (B * 128 / 100)
          bufferB.data[i] = 128 + bKoef
          bufferB.data[i + 1] = 128 + bKoef
          bufferB.data[i + 2] = 128 - bKoef
          bufferB.data[i + 3] = 255
        }

        MAIN_IMAGE_BUFFER_LAB = {
          l: Uint8ClampedArray.from(labBuffer.l),
          a: Uint8ClampedArray.from(labBuffer.a),
          b: Uint8ClampedArray.from(labBuffer.b)
        }

        this.$refs.canvasComponent1.width = width
        this.$refs.canvasComponent2.width = width
        this.$refs.canvasComponent3.width = width

        this.$refs.canvasComponent1.height = height
        this.$refs.canvasComponent2.height = height
        this.$refs.canvasComponent3.height = height

        ctxL.putImageData(bufferL, 0, 0)
        ctxA.putImageData(bufferA, 0, 0)
        ctxB.putImageData(bufferB, 0, 0)
        this.loading = false

        LAST_COMPONENT1_BUFFER = bufferL
        LAST_COMPONENT2_BUFFER = bufferA
        LAST_COMPONENT3_BUFFER = bufferB
      }, 0)
    },
    convertToRGB () {
      this.loading = true
      LAST_COMPONENT1_BUFFER = null
      LAST_COMPONENT2_BUFFER = null
      LAST_COMPONENT3_BUFFER = null
      LAST_COMPONENT4_BUFFER = null
      this.selectedColorSystem = 'RGB'
      const ctxMain = CONTEXT_WEAKMAP.get(this.$refs.canvasMain)
      const ctxR = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent1)
      const ctxG = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent2)
      const ctxB = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent3)
      const ctxI = CONTEXT_WEAKMAP.get(this.$refs.canvasComponent4)

      const { width, height } = this.$refs.canvasMain
      if (!ctxMain || !ctxR || !ctxG || !ctxB || !ctxI) return

      const bufferMain = ctxMain.getImageData(0, 0, width, height)
      const bufferR = ctxMain.getImageData(0, 0, width, height)
      const bufferG = ctxMain.getImageData(0, 0, width, height)
      const bufferB = ctxMain.getImageData(0, 0, width, height)
      const bufferI = ctxMain.getImageData(0, 0, width, height)

      this.convertToGrayscale(
        this.$refs.canvasComponent4,
        ctxI,
        bufferI,
        width,
        height
      )

      for (let i = 0; i < bufferMain.data.length; i += 4) {
        bufferR.data[i] = bufferMain.data[i]
        bufferR.data[i + 1] = 0
        bufferR.data[i + 2] = 0
        bufferR.data[i + 3] = 255

        bufferG.data[i] = 0
        bufferG.data[i + 1] = bufferMain.data[i + 1]
        bufferG.data[i + 2] = 0
        bufferG.data[i + 3] = 255

        bufferB.data[i] = 0
        bufferB.data[i + 1] = 0
        bufferB.data[i + 2] = bufferMain.data[i + 2]
        bufferB.data[i + 3] = 255
      }
      this.$refs.canvasComponent1.width = width
      this.$refs.canvasComponent2.width = width
      this.$refs.canvasComponent3.width = width

      this.$refs.canvasComponent1.height = height
      this.$refs.canvasComponent2.height = height
      this.$refs.canvasComponent3.height = height

      ctxR.putImageData(bufferR, 0, 0)
      ctxG.putImageData(bufferG, 0, 0)
      ctxB.putImageData(bufferB, 0, 0)
      this.loading = false

      LAST_COMPONENT1_BUFFER = bufferR
      LAST_COMPONENT2_BUFFER = bufferG
      LAST_COMPONENT3_BUFFER = bufferB
    },
    convertToGrayscale (canvas, context, imageData, width, height) {
      for (let i = 0; i < imageData.data.length; i += 4) {
        const intensity = parseInt(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2])
        imageData.data[i] = intensity
        imageData.data[i + 1] = intensity
        imageData.data[i + 2] = intensity
        imageData.data[i + 3] = 255
      }
      canvas.width = width
      canvas.height = height
      context.putImageData(imageData, 0, 0)

      LAST_COMPONENT4_BUFFER = imageData
    },
    isImageSizeEqual () {
      const { width: w1, height: h1 } = this.$refs.canvas1
      const { width: w2, height: h2 } = this.$refs.canvas2
      if (
        w1 !== w2 ||
        h1 !== h2
      ) {
        alert('Error: Image dimesions must be the same!')
        return false
      }
      return true
    },
    copyMainImageBuffer (canvas, context) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
      const r = []
      const g = []
      const b = []
      const intensity = []

      for (let i = 0; i < imageData.data.length; i += 4) {
        r.push(imageData.data[i])
        g.push(imageData.data[i + 1])
        b.push(imageData.data[i + 2])
        intensity.push(parseInt(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2]))
      }

      MAIN_IMAGE_BUFFER = {
        r: Uint8ClampedArray.from(r),
        g: Uint8ClampedArray.from(g),
        b: Uint8ClampedArray.from(b),
        i: Uint8ClampedArray.from(intensity)
      }
      this.loading = false
    },
    openImage (event) {
      const path = this.getFilePath()
      this.loading = true
      const canvas = event.target
      if (!canvas) {
        this.loading = false
        return
      }
      this.loadFromPathToCanvas(canvas, path[0])
    },
    loadFromPathToCanvas (canvas, path) {
      const ctx = CONTEXT_WEAKMAP.get(canvas)
      if (!ctx) return
      this.getImageBase64(path)
        .then(imageBase64 => {
          const image = new Image()
          image.src = imageBase64
          image.onload = () => {
            canvas.width = image.width
            canvas.height = image.height
            ctx.drawImage(image, 0, 0)
            this.copyMainImageBuffer(canvas, ctx)
          }
        })
        .catch(e => {
          this.loading = false
          console.error(e)
        })
    },
    getImageBase64 (path) {
      return new Promise((resolve, reject) => {
        Jimp.read(path, (err, image) => {
          if (err) reject(err)
          image.getBase64(Jimp.MIME_JPEG, (err, data) => {
            if (err) reject(err)
            resolve(data)
          })
        })
      })
    },
    getFilePath () {
      return dialog.showOpenDialog({ properties: ['openFile'] })
    }
  }
}
</script>

<style scoped>
  canvas {
    border: 1px solid black;
    width: 100%;
    transition: 0.3s ease;
    box-shadow: none;
    border-radius: 3px;
  }
  .hover:hover {
    box-shadow: 0px 0px 10px;
    cursor: pointer;
  }
  .overlay-dark {
      position: fixed;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 999;
      background-color: #000000;
      opacity: 0.9;
  }
</style>