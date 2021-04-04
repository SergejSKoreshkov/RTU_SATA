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
          id='canvasExtractedRegion'
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
      <div class="col-4">
        <div id="thresholdIdent">Threshold: 100</div>
        <input type="range" min="1" max="100" value="100" id="thresholdSlider" @change="sliderChange">
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
      img_loaded: false,
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
      cv.imshow('canvasExtractedRegion', src)

      const imgGray = new cv.Mat()
      const imgColor = new cv.Mat()
      cv.cvtColor(src, imgGray, cv.COLOR_RGBA2GRAY)
      cv.cvtColor(src, imgColor, cv.COLOR_RGBA2RGB)
      src.delete()
      const dst = cv.Mat.zeros(imgColor.cols, imgColor.rows, cv.CV_32FC1)
      /// Detector parameters
      const thresh = document.getElementById('thresholdSlider').value
      const blockSize = 4
      const apertureSize = 3
      const k = 0.04
      /// Detecting corners
      cv.cornerHarris(imgGray, dst, blockSize, apertureSize, k, cv.BORDER_DEFAULT)
      /// Normalizing
      const dstNorm = new cv.Mat()
      const dstNormScaled = new cv.Mat()
      cv.normalize(dst, dstNorm, 0, 255, 32, cv.CV_32FC1, new cv.Mat())
      cv.convertScaleAbs(dstNorm, dstNormScaled, 1, 0)

      // let avgd_pixs = [ ]
      let stack = [ ]
      /// Drawing a circle around corners
      for (let j = 0; j < dstNorm.rows; j++) {
        for (let i = 0; i < dstNorm.cols; i++) {
          if (dstNorm.floatAt(j, i) > thresh) {
            /* ----------------------------------------------------------------------
            if (stack.length === 0) {
              stack.push([j, i])
            } else {
              let pt = stack[stack.length - 1]
              let distance = Math.sqrt(Math.pow(pt[0] - j, 2) + Math.pow(pt[1] - i, 2))

              if (distance > 5) {
                let avgPix = this.getAveragePointCoord(stack)
                cv.circle(dstNormScaled, new cv.Point(avgPix[1], avgPix[0]), 3, new cv.Scalar(255, 0, 0, 255), 1)
                console.log(stack, 'AveragePIX: ', avgPix)
                stack = [ ]
              } else {
                stack.push([j, i])
              }
            }
            ------------------------------------------------------------------------ */
            stack.push([j, i])
          }
        }
      }

      // let avgPix = this.getAveragePointCoord(stack)
      // cv.circle(dstNormScaled, new cv.Point(avgPix[1], avgPix[0]), 3, new cv.Scalar(255, 0, 0, 255), 1)
      // console.log(stack, 'AveragePIX: ', avgPix)

      let res = [ ]
      let tmpStack = [ stack[0] ]
      stack.splice(0, 1)
      while (stack.length > 0) {
        for (let i = 0; i < stack.length; i++) {
          let pt = tmpStack[tmpStack.length - 1]
          let distance = Math.sqrt(Math.pow(pt[0] - stack[i][0], 2) + Math.pow(pt[1] - stack[i][1], 2))

          if (distance < 10) {
            tmpStack.push(stack[i])
            stack.splice(i, 1)
            i--
          }
        }

        let avgPt = this.getAveragePointCoord(tmpStack)
        res.push(avgPt)

        tmpStack = [stack[0]]
        stack.splice(0, 1)
      }

      let font = 0
      console.log(res)
      for (let i = 0; i < res.length; i++) {
        cv.circle(dstNormScaled, new cv.Point(res[i][1], res[i][0]), 3, new cv.Scalar(255, 0, 0, 255), 1)
        if (res.length <= 7) {
          cv.putText(dstNormScaled, (i + 1).toString(), new cv.Point(res[i][1], res[i][0]), font, 0.5, new cv.Scalar(0, 255, 0, 255), 2, cv.LINE_AA)
        }
      }

      cv.imshow('openCvCanvas', dstNormScaled)
      dst.delete()
      dstNorm.delete()
      dstNormScaled.delete()
      imgGray.delete()
      imgColor.delete()
      this.img_loaded = true
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
    sliderChange () {
      let slider = document.getElementById('thresholdSlider')
      let indicator = document.getElementById('thresholdIdent')
      indicator.innerHTML = 'Threshold: ' + slider.value

      if (this.img_loaded !== false) {
        this.canvasToCvToCanvas()
      }
    },
    getAveragePointCoord (stack) {
      let maxX = Number.MIN_SAFE_INTEGER
      let minX = Number.MAX_SAFE_INTEGER
      let maxY = Number.MIN_SAFE_INTEGER
      let minY = Number.MAX_SAFE_INTEGER

      for (let i = 0; i < stack.length; i++) {
        // Min / Max X
        if (stack[i][0] > maxX) maxX = stack[i][0]
        if (stack[i][0] < minX) minX = stack[i][0]

        // Min / Max Y
        if (stack[i][1] > maxY) maxY = stack[i][1]
        if (stack[i][1] < minY) minY = stack[i][1]
      }

      return [maxX - Math.floor((maxX - minX) / 2), maxY - Math.floor((maxY - minY) / 2)]
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