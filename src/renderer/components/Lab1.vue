<template>
  <div class="lab4">
    <div class="overlay-dark" v-show="loading">
      <div class="spinner-border" role="status">
        <span class="sr-only">Loading...</span>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <h4>Original image</h4>
      </div>
      <div class="col-4">
        <h4>Select region</h4>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <canvas
          ref="canvasMain"
          width="200"
          height="100"
        ></canvas>
        <button @click="openImage">Load image</button>
      </div>
      <div class="col-4">
        <canvas
          style="cursor: pointer"
          ref="canvasRegion"
          width="200"
          height="100"
          @mousemove="canvasClick"
        ></canvas>
      </div>
      <div class="col-4">
        <canvas
          style="cursor: pointer"
          ref="canvasSelectedObject"
          width="200"
          height="100"
        ></canvas>
      </div>
    </div>
  </div>
</template>

<script>
const Jimp = require('jimp')
const { dialog } = require('electron').remote
// const { some } = require('lodash')

let CONTEXT_WEAKMAP = null

export default {
  name: 'lab1',
  data () {
    return {
      loading: false
    }
  },
  mounted () {
    CONTEXT_WEAKMAP = new WeakMap()
    CONTEXT_WEAKMAP.set(this.$refs.canvasMain, this.$refs.canvasMain.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasRegion, this.$refs.canvasRegion.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasSelectedObject, this.$refs.canvasSelectedObject.getContext('2d'))
  },
  methods: {
    canvasClick (event) {
      const canvas = event.target
      const { width, height } = canvas
      const ctx = CONTEXT_WEAKMAP.get(canvas)
      const imageData = ctx.getImageData(0, 0, width, height)

      const size = event.target.getBoundingClientRect()
      const x = Math.trunc((event.clientX - size.left) / size.width * width)
      const y = Math.trunc((event.clientY - size.top) / size.height * height)

      const [regionImageData] = this.regionGrow(canvas, ctx, imageData, { x, y })

      const canvasSelectedObject = this.$refs.canvasSelectedObject
      const ctxSelectedObject = CONTEXT_WEAKMAP.get(canvasSelectedObject)
      canvasSelectedObject.width = width
      canvasSelectedObject.height = height

      ctxSelectedObject.putImageData(regionImageData, 0, 0)
    },
    regionGrow (canvas, ctx, imageData, point) {
      const { width, height } = canvas
      let pixelCoordinates = Math.trunc(width * point.y + point.x) * 4
      const startIntensity = imageData.data[pixelCoordinates]
      const used = new Uint8ClampedArray(width * height * 4)
      const stack = [[point.x, point.y]]
      const T = 5

      const resultImageData = new ImageData(width, height)

      while (stack.length !== 0) {
        const [ x, y ] = stack.shift()
        pixelCoordinates = Math.trunc(width * y + x) * 4
        const nowIntensity = imageData.data[pixelCoordinates]
        if (
          startIntensity - T < nowIntensity &&
          startIntensity + T > nowIntensity &&
          !used[pixelCoordinates]
        ) {
          used[pixelCoordinates] = true

          resultImageData.data[pixelCoordinates] = 0
          resultImageData.data[pixelCoordinates + 1] = 255
          resultImageData.data[pixelCoordinates + 2] = 0
          resultImageData.data[pixelCoordinates + 3] = 255

          stack.push([x + 1, y])
          stack.push([x - 1, y])
          stack.push([x, y + 1])
          stack.push([x, y - 1])
        }
      }
      return [resultImageData, imageData]
    },
    // FILE LOADING SECTION =-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=
    openImage () {
      const path = this.getFilePath()
      this.loading = true
      const canvas = this.$refs.canvasMain
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
            this.convertToGrayscale(canvas, this.$refs.canvasRegion)
            this.loading = false
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
    },
    convertToGrayscale (canvasSrc, canvasDest) {
      const { width, height } = canvasSrc
      const contextDest = CONTEXT_WEAKMAP.get(canvasDest)
      const contextSrc = CONTEXT_WEAKMAP.get(canvasSrc)
      const imageData = contextSrc.getImageData(0, 0, width, height)
      for (let i = 0; i < imageData.data.length; i += 4) {
        const intensity = parseInt(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2])
        imageData.data[i] = intensity
        imageData.data[i + 1] = intensity
        imageData.data[i + 2] = intensity
        imageData.data[i + 3] = 255
      }
      canvasDest.width = width
      canvasDest.height = height
      contextDest.putImageData(imageData, 0, 0)
    }
  }
}
</script>

<style scoped>
  canvas {
    border: 1px solid black;
    width: 100%;
    box-shadow: none;
    border-radius: 3px;
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