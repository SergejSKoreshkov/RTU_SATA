<template>
  <div class="lab4">
    <div class="overlay-dark" v-show="loading">
      <div class="spinner-border" role="status">
        <span class="sr-only">Loading...</span>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <h4>Click to add image</h4>
      </div>
      <div class="col-4">
        <h4>Prewitt</h4>
      </div>
      <div class="col-4">
        <h4>Bradley</h4>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <canvas
          class="hover"
          @click="openImage"
          ref="canvasMain"
          width="200"
          height="100"
        ></canvas>
      </div>
      <div class="col-4">
        <canvas ref="canvasPrewitt" width="200" height="100"></canvas>
      </div>
      <div class="col-4">
        <canvas ref="canvasBradley" width="200" height="100"></canvas>
      </div>
    </div>
    <div class="row">
      <div class="col-4 offset-8">
        <div class="flex-align">
          S = {{width}} / {{S}} <input type="range" min="0" max="8" step="1" v-model="sPow" @change="bradley" style="width: 80%"> 
        </div>
        <div class="flex-align">
          t = {{t}} <input type="range" min="0" max="1" step="0.05" v-model="t" @change="bradley" style="width: 80%"> 
        </div>
        <div class="flex-align">
          Invert = {{invert}} <input type="checkbox" v-model="invert" @change="bradley" style="margin-right: auto; margin-left: 1em"> 
          Map to closest color (R,G,B,C,M,Y) = {{colorSegments}} <input type="checkbox" v-model="colorSegments" @change="bradley" style="margin-right: auto; margin-left: 1em"> 
        </div>
      </div>
    </div>
  </div>
</template>

<script>
const Jimp = require('jimp')
const { dialog } = require('electron').remote

let CONTEXT_WEAKMAP = null

const prewittX = [
  [-1, 0, 1],
  [-1, 0, 1],
  [-1, 0, 1]
]

const prewittY = [
  [1, 1, 1],
  [0, 0, 0],
  [-1, -1, -1]
]

const colors = [
  { r: 0, g: 0, b: 255 },
  { r: 0, g: 255, b: 0 },
  { r: 255, g: 0, b: 0 },
  { r: 255, g: 255, b: 0 },
  { r: 0, g: 255, b: 255 },
  { r: 255, g: 0, b: 255 }
]

export default {
  name: 'lab4',
  computed: {
    S () {
      return Math.pow(2, this.sPow)
    }
  },
  data () {
    return {
      loading: false,
      t: 0.15,
      sPow: 1,
      width: 0,
      invert: false,
      colorSegments: true
    }
  },
  mounted () {
    CONTEXT_WEAKMAP = new WeakMap()
    CONTEXT_WEAKMAP.set(this.$refs.canvasMain, this.$refs.canvasMain.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasPrewitt, this.$refs.canvasPrewitt.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasBradley, this.$refs.canvasBradley.getContext('2d'))
  },
  methods: {
    performAlgorithms () {
      const canvasMain = this.$refs.canvasMain
      const canvasPrewitt = this.$refs.canvasPrewitt
      const canvasBradley = this.$refs.canvasBradley
      const ctxMain = CONTEXT_WEAKMAP.get(canvasMain)
      const ctxPrewitt = CONTEXT_WEAKMAP.get(canvasPrewitt)

      const { width, height } = canvasMain
      this.width = width
      canvasPrewitt.width = width
      canvasPrewitt.height = height
      canvasBradley.width = width
      canvasBradley.height = height

      // Prewitt
      const buffer = ctxMain.getImageData(0, 0, width, height)
      const resultBuffer = ctxMain.getImageData(0, 0, width, height)

      for (let i = width * 4 + 4; i < buffer.data.length - (width * 4 + 4); i += 4) {
        let gX = 0
        let gY = 0
        for (let fi = 0; fi < 3; fi++) {
          for (let fj = 0; fj < 3; fj++) {
            const index = (i + fj * 4 - 4) + fi * width * 4 - width * 4
            const intensity = parseInt(0.299 * buffer.data[index] + 0.587 * buffer.data[index + 1] + 0.114 * buffer.data[index + 2])
            gX += intensity * prewittX[fi][fj]
            gY += intensity * prewittY[fi][fj]
          }
        }
        const result = Math.sqrt(Math.pow(gX, 2) + Math.pow(gY, 2))
        resultBuffer.data[i] = result < 128 ? 0 : 255
        resultBuffer.data[i + 1] = result < 128 ? 0 : 255
        resultBuffer.data[i + 2] = result < 128 ? 0 : 255
        resultBuffer.data[i + 4] = 255
      }
      ctxPrewitt.putImageData(resultBuffer, 0, 0)

      this.bradley()
    },
    bradley () {
      const canvasMain = this.$refs.canvasMain
      const ctxMain = CONTEXT_WEAKMAP.get(canvasMain)
      const canvasBradley = this.$refs.canvasBradley
      const ctxBradley = CONTEXT_WEAKMAP.get(canvasBradley)
      const { width, height } = canvasMain

      // Bradley
      const buffer = ctxMain.getImageData(0, 0, width, height)
      const intensityArray = new Array(width * height).fill(0)
      const rArray = new Array(width * height).fill(0)
      const gArray = new Array(width * height).fill(0)
      const bArray = new Array(width * height).fill(0)
      let index = 0
      for (let i = 0; i < buffer.data.length; i += 4) {
        const intensity = parseInt(0.299 * buffer.data[i] + 0.587 * buffer.data[i + 1] + 0.114 * buffer.data[i + 2])
        intensityArray[index] = intensity
        rArray[index] = buffer.data[i]
        gArray[index] = buffer.data[i + 1]
        bArray[index] = buffer.data[i + 2]
        index++
      }

      const S = width / this.S
      let s2 = S / 4
      const t = this.t
      let sum = 0
      let count = 0
      index = 0
      let x1 = 0
      let y1 = 0
      let x2 = 0
      let y2 = 0

      const integralImage = new Array(width * height).fill(0)
      const res = new Array(width * height).fill(0)

      for (let i = 0; i < width; i++) {
        sum = 0
        for (let j = 0; j < height; j++) {
          index = j * width + i
          sum += intensityArray[index]
          if (i === 0) {
            integralImage[index] = sum
          } else {
            integralImage[index] = integralImage[index - 1] + sum
          }
        }
      }

      for (let i = 0; i < width; i++) {
        for (let j = 0; j < height; j++) {
          index = j * width + i

          x1 = i - s2
          x2 = i + s2
          y1 = j - s2
          y2 = j + s2

          if (x1 < 0) { x1 = 0 }
          if (x2 >= width) { x2 = width - 1 }
          if (y1 < 0) { y1 = 0 }
          if (y2 >= height) { y2 = height - 1 }

          count = (x2 - x1) * (y2 - y1)

          sum = integralImage[y2 * width + x2] - integralImage[y1 * width + x2] -
             integralImage[y2 * width + x1] + integralImage[y1 * width + x1]
          if ((intensityArray[index] * count) < (sum * (1 - t))) { res[index] = 0 } else { res[index] = 255 }
        }
      }

      res.forEach((el, index) => {
        if (this.colorSegments) {
          if (el !== 0) {
            buffer.data[index * 4] = el
            buffer.data[index * 4 + 1] = el
            buffer.data[index * 4 + 2] = el
            buffer.data[index * 4 + 3] = 255
            return
          }
          const resultArray = colors
            .map(pixel =>
              Math.sqrt(Math.pow(rArray[index] - pixel.r, 2) + Math.pow(gArray[index] - pixel.g, 2) + Math.pow(bArray[index] - pixel.b, 2))
            )

          const bestColorIndex = resultArray.indexOf(Math.min(...resultArray))
          const color = colors[bestColorIndex]
          buffer.data[index * 4] = color.r
          buffer.data[index * 4 + 1] = color.g
          buffer.data[index * 4 + 2] = color.b
          buffer.data[index * 4 + 3] = 255
        } else {
          if (this.invert) el = 255 - el
          buffer.data[index * 4] = el
          buffer.data[index * 4 + 1] = el
          buffer.data[index * 4 + 2] = el
          buffer.data[index * 4 + 3] = 255
        }
      })

      ctxBradley.putImageData(buffer, 0, 0)
    },
    openImage (event) {
      const path = this.getFilePath()
      this.loading = true
      const canvas = event.target
      if (!canvas) {
        this.loading = false
        return
      }
      if (!path) {
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
            this.loading = false
            this.performAlgorithms()
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
  },
  watch: {
    scale () {
      this.debounceScale()
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
.flex-align {
  display: flex;
  justify-content: space-between;
  padding-bottom: 1em;
  align-items: center;
}
</style>