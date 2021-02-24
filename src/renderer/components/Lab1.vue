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
          @mousedown.left="canvasClick"
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

    <!-- Extracted region, Matched pattern, Region-Pattern match percent -->
    <div class='row' style='margin-top: 24px;'>
      <div class='col-4'>
        <h4>Extracted region</h4>
      </div>
      <div class='col-4'>
        <h4>Matching pattern</h4>
      </div>
    </div>
    <div class='row'>
      <div class='col-4'>
        <canvas id='extractedRegion' width='200' height='100'></canvas>
      </div>
      <div class='col-4'>
        <canvas id='matchedPattern' width='200' height='100'></canvas>
      </div>
      <div class='col-4'>
        <div id='match-percent'></div>
      </div>
    </div>
  </div>
</template>

<script>
const Jimp = require('jimp')
const { dialog } = require('electron').remote
// const { some } = require('lodash')

let CONTEXT_WEAKMAP = null
let REGION_BOUNDARIES = null

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

      // Calculating last region's dimensions
      let regWidth = REGION_BOUNDARIES.x_max - REGION_BOUNDARIES.x_min + 1
      let regHeight = REGION_BOUNDARIES.y_max - REGION_BOUNDARIES.y_min + 1

      // Extracting pixels that belongs to the selected region
      let regData = this.extractRegion(regionImageData, width, height, regWidth, regHeight)

      // Setting up all alpha values to be equal to 255, so that the black color could be seen
      this.setAlphaMax(regData)

      // Drawing region on the canvas
      let regCanvas = document.getElementById('extractedRegion')
      regCanvas.height = height; regCanvas.width = width
      let regCanvasCtx = regCanvas.getContext('2d')
      regCanvasCtx.putImageData(regData, 0, 0)

      const tgtWidth = width
      const tgtHeight = height

      // Resizing extracted region
      let regDataResized
      if (regHeight === tgtHeight && regWidth === tgtWidth) {
        regDataResized = regData
      } else {
        regDataResized = this.resizeImage(regData, regWidth, regHeight, tgtWidth, tgtHeight)
      }

      // Drawing resized region
      regCanvas = document.getElementById('matchedPattern')
      regCanvas.height = height; regCanvas.width = width
      regCanvasCtx = regCanvas.getContext('2d')
      regCanvasCtx.putImageData(regDataResized, 0, 0)

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

      // Resetting region's boundaries ...
      REGION_BOUNDARIES = {
        'x_max': Number.MIN_SAFE_INTEGER,
        'x_min': Number.MAX_SAFE_INTEGER,
        'y_max': Number.MIN_SAFE_INTEGER,
        'y_min': Number.MAX_SAFE_INTEGER
      }

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

          // Calculating region's boundaries for both axis
          if (x > REGION_BOUNDARIES.x_max) {
            REGION_BOUNDARIES.x_max = x
          }

          if (x < REGION_BOUNDARIES.x_min) {
            REGION_BOUNDARIES.x_min = x
          }

          if (y > REGION_BOUNDARIES.y_max) {
            REGION_BOUNDARIES.y_max = y
          }

          if (y < REGION_BOUNDARIES.y_min) {
            REGION_BOUNDARIES.y_min = y
          }

          // Adding into the stack those out of four neighbour pixels, that aren't going beyond the image borders
          if ((x + 1) < width) {
            stack.push([x + 1, y])
          }

          if ((x - 1) >= 0) {
            stack.push([x - 1, y])
          }

          if ((y + 1) < height) {
            stack.push([x, y + 1])
          }

          if ((y - 1) >= 0) {
            stack.push([x, y - 1])
          }
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
    },
    extractRegion (imageData, width, height, regWidth, regHeight) {
      let regionData = new ImageData(regWidth, regHeight)

      // Copy region from source to new cointainer
      for (let row = 0; row <= regHeight; row++) {
        for (let col = 0; col <= regWidth; col++) {
          // Translating (X, Y) coordinate to offset within the byte array.
          let pixCoordinatesOriginal = ((REGION_BOUNDARIES.y_min + row) * width + (REGION_BOUNDARIES.x_min + col)) * 4
          let pixCoordinates = (row * regWidth + col) * 4

          // Copying bytes from original image to the region's container
          /* R */ regionData.data[pixCoordinates] = imageData.data[pixCoordinatesOriginal]
          /* G */ regionData.data[pixCoordinates + 1] = imageData.data[pixCoordinatesOriginal + 1]
          /* B */ regionData.data[pixCoordinates + 2] = imageData.data[pixCoordinatesOriginal + 2]
          /* A */ regionData.data[pixCoordinates + 3] = imageData.data[pixCoordinatesOriginal + 3]
        }
      }

      return regionData
    },
    setAlphaMax (regionData) {
      for (let i = 0; i < regionData.data.length; i += 4) regionData.data[i + 3] = 255
    },
    resizeImage (imageData, width, height, nWidth, nHeight) {
      let resizedImageData = new ImageData(nWidth, nHeight)
      let yRatio = height / nHeight
      let xRatio = width / nWidth
      let px, py, q, w

      for (let x = 0; x <= nHeight; x++) {
        for (let y = 0; y <= nWidth; y++) {
          // Keeping aspect ratio
          px = Math.floor(y * xRatio)
          py = Math.floor(x * yRatio)

          // Translating pixel's position
          q = ((x * nWidth) + y) * 4
          w = Math.floor(((py * width) + px) * 4)

          // Copying original image pixels into resized image
          /* R */ resizedImageData.data[q] = imageData.data[w]
          /* G */ resizedImageData.data[q + 1] = imageData.data[w + 1]
          /* B */ resizedImageData.data[q + 2] = imageData.data[w + 2]
          /* A */ resizedImageData.data[q + 3] = 255
        }
      }

      return resizedImageData
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
  #match-percent {
    font-weight: 500;
    text-align: center;
  }
</style>