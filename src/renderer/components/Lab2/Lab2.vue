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
        <h4>Grayscale image</h4>
      </div>
      <div class="col-4">
        <h4>Extracted region</h4>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <canvas
          ref="canvasColored"
        ></canvas>
        <button class="btn btn-primary w-100" @click="openImage">Load image</button>
      </div>
      <div class="col-4">
        <canvas
          ref="canvasGrayscale"
          @click="canvasClick"
        ></canvas>
        <button class="btn btn-secondary w-100" disabled>Click on canvas</button>
      </div>
      <div class="col-4">
        <canvas
          ref="canvasExtractedRegion"
        ></canvas>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <h4>Open CV Test</h4>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <canvas
          ref="openCvCanvas"
          id="openCvCanvas"
        ></canvas>
      </div>
    </div>
  </div>
</template>

<script>
const { dialog } = require('electron').remote
const { openImage } = require('./LoadImage').default
const { regionGrow, extractRegion } = require('./RegionGrow').default
const { vectorTo2DMatrix, matrix2DToVector } = require('./Helpers').default
const { mooreNeighborTrace } = require('./MooreNeighborTracing').default

let cv = null

export default {
  name: 'lab2',
  data () {
    return {
      loading: false
    }
  },
  mounted () {
    this.loading = true
    const openCvScript = document.createElement('script')
    openCvScript.setAttribute('src', '/static/js/opencv.js')
    document.body.appendChild(openCvScript)
    openCvScript.addEventListener('load', () => {
      console.log('OPEN CV READY')
      cv = window.module.exports
      this.loading = false
    }, false)
  },
  methods: {
    canvasToCvToCanvas () {
      const srcCanvas = this.$refs.canvasExtractedRegion
      const srcCtx = srcCanvas.getContext('2d')
      const imgData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height)

      const src = cv.matFromImageData(imgData)

      const imgGray = new cv.Mat()
      const imgColor = new cv.Mat()
      cv.cvtColor(src, imgGray, cv.COLOR_RGBA2GRAY)
      cv.cvtColor(src, imgColor, cv.COLOR_RGBA2RGB)
      src.delete()
      const dst = cv.Mat.zeros(imgColor.cols, imgColor.rows, cv.CV_32FC1)
      /// Detector parameters
      const thresh = 100
      const blockSize = 8
      const apertureSize = 3
      const k = 0.04
      /// Detecting corners
      cv.cornerHarris(imgGray, dst, blockSize, apertureSize, k, cv.BORDER_DEFAULT)
      /// Normalizing
      const dstNorm = new cv.Mat()
      const dstNormScaled = new cv.Mat()
      cv.normalize(dst, dstNorm, 0, 255, 32, cv.CV_32FC1, new cv.Mat())
      cv.convertScaleAbs(dstNorm, dstNormScaled, 1, 0)
      /// Drawing a circle around corners
      for (let j = 0; j < dstNorm.rows; j++) {
        for (let i = 0; i < dstNorm.cols; i++) {
          if (dstNorm.floatAt(j, i) > thresh) {
            cv.circle(dstNormScaled, new cv.Point(i, j), 3, new cv.Scalar(255, 0, 0, 255), 1)
          }
        }
      }
      cv.imshow('openCvCanvas', dstNormScaled)
      dst.delete()
      dstNorm.delete()
      dstNormScaled.delete()
      imgGray.delete()
      imgColor.delete()
    },
    canvasClick (event) {
      this.loading = true
      setTimeout(() => {
        const canvas = event.target
        const { width, height } = canvas
        const ctx = canvas.getContext('2d')
        const imageData = ctx.getImageData(0, 0, width, height)

        const size = event.target.getBoundingClientRect()
        const x = Math.trunc((event.clientX - size.left) / size.width * width)
        const y = Math.trunc((event.clientY - size.top) / size.height * height)

        const [ regionImageData, regionBoundaries ] = regionGrow(5, canvas, imageData, { x, y })

        const extractedRegion = extractRegion(width, regionImageData, regionBoundaries)

        // Not needed here. Just for example of how vector -> matrix (2D pixel array) -> vector works
        // Result vector is the same as extractedRegion
        // matrix is [width]x[height] array with { r, g, b, a } values
        // For example matrix[w][h].r is red, matrix[w][h].g green ...
        const matrix = vectorTo2DMatrix(extractedRegion)
        const objectBordersMatrix = vectorTo2DMatrix(new ImageData(extractedRegion.width, extractedRegion.height))
        mooreNeighborTrace(matrix, objectBordersMatrix)
        const vector = matrix2DToVector(objectBordersMatrix)

        const regionCanvas = this.$refs.canvasExtractedRegion
        const regionCtx = regionCanvas.getContext('2d')
        regionCanvas.height = vector.height
        regionCanvas.width = vector.width
        regionCtx.putImageData(vector, 0, 0)

        // CV module loads in async. Better to check, if it's ready
        if (cv) {
          this.canvasToCvToCanvas()
        }

        this.loading = false
      }, 100)
    },
    openImage () {
      this.loading = true
      openImage(this.getFilePath(), this.$refs.canvasColored, this.$refs.canvasGrayscale)
        .then(() => { this.loading = false })
        .catch(() => { this.loading = false })
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
</style>