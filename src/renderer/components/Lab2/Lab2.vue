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
        <div id="thresholdIdent">Threshold: {{ sliderValue }}</div>
        <input type="range" min="1" max="150" v-model="sliderValue" @change="sliderChange">
        <div id="thresholdIdent">Result: {{ result }}</div>
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
      loading: false,
      sliderValue: 100,
      result: ''
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
    async canvasToCvToCanvas () {
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
      const thresh = this.sliderValue
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
            stack.push([j, i])
          }
        }
      }

      if (stack.length < 1000) {
        let res = [ ]
        let tmpStack = [ stack[0] ]
        stack.splice(0, 1)
        while (stack.length > 0) {
          for (let i = 0; i < stack.length; i++) {
            let pt = tmpStack[tmpStack.length - 1]
            let distance = Math.sqrt(Math.pow(pt[0] - stack[i][0], 2) + Math.pow(pt[1] - stack[i][1], 2))

            if (distance < 20) {
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
        cv.cvtColor(dstNormScaled, dstNormScaled, cv.COLOR_GRAY2RGB)
        for (let i = 0; i < res.length; i++) {
          cv.circle(imgColor, new cv.Point(res[i][1], res[i][0]), 3, new cv.Scalar(255, 0, 0, 255), 1)
        }
        const contour = []
        // JARVIS
        const fns = [
          [Math.atan2, (a, b) => a.y - b.y || a.x - b.x],
          [(x, y) => Math.atan2(-x, -y), (a, b) => b.y - a.y || b.x - a.x]
        ]
        for (let i = 0; i < fns.length; i++) {
          const [angleFn, sortFn] = fns[i]
          const mappedPoints = res.map(([y, x]) => ({ x, y: srcCanvas.height - y }))
          if (mappedPoints.length < 3) return
          let sorted = mappedPoints.sort(sortFn)
          let [pointNow, ...restPoints] = sorted
          const lastPoint = {...restPoints[restPoints.length - 1]}
          while (!(pointNow.x === lastPoint.x && pointNow.y === lastPoint.y)) {
            restPoints = restPoints.map(({ x, y }) => {
              const ix = x - pointNow.x
              const iy = y - pointNow.y
              let angle = angleFn(iy, ix)
              if (angle < 0) angle = 2 * Math.PI + angle
              return { x, y, a: angle }
            }).sort((a, b) => a.a - b.a)
            pointNow = restPoints.splice(0, 1)[0]
            contour.push({ x: pointNow.x, y: srcCanvas.height - pointNow.y })
          }
        }
        let font = 0
        const angles = contour.map((el, index, arr) => {
          const pointA = el
          const pointB = index === arr.length - 1 ? arr[0] : arr[index + 1]
          const potinC = index === 0 ? arr[arr.length - 1] : arr[index - 1]
          const a = Math.sqrt(Math.pow(pointB.x - potinC.x, 2) + Math.pow(pointB.y - potinC.y, 2))
          const b = Math.sqrt(Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2))
          const c = Math.sqrt(Math.pow(potinC.x - pointA.x, 2) + Math.pow(potinC.y - pointA.y, 2))
          const angle = Math.round(Math.acos((b * b + c * c - a * a) / (2 * b * c)) * 180 / Math.PI)

          const result = { ...pointA }
          if (result.y < 15) result.y = 15
          if (result.x > srcCanvas.width - 60) result.x = srcCanvas.width - 60
          if (res.length <= 9) {
            cv.putText(imgColor, `${index + 1} (${angle})`, new cv.Point(result.x, result.y), font, 0.5, new cv.Scalar(255, 255, 0, 255), 1.5, cv.LINE_AA)
          }
          return angle
        })

        this.result = ''
        if (angles.length === 3) {
          if (angles.every(el => el === 60 || el === 59 || el === 61)) this.result += 'Equilateral '
          if (
            Math.abs(angles[0] - angles[1]) < 2 ||
          Math.abs(angles[1] - angles[2]) < 2 ||
          Math.abs(angles[2] - angles[0]) < 2
          ) this.result += 'Isosceles '
          if (angles.some(el => el === 90 || el === 91 || el === 89)) this.result += 'Right-angle '
          this.result += 'Triangle'
        } else if (angles.length === 4) {
          const d1 = Math.sqrt(Math.pow(contour[0].x - contour[2].x, 2) + Math.pow(contour[0].y - contour[2].y, 2))
          const d2 = Math.sqrt(Math.pow(contour[1].x - contour[3].x, 2) + Math.pow(contour[1].y - contour[3].y, 2))

          if (angles.every(el => el === 90 || el === 91 || el === 89)) {
            if (
              Math.abs(srcCanvas.height - srcCanvas.width) < 2
            ) this.result += 'Square'
            else this.result += 'Rectangle'
          } else if (Math.abs(angles[0] - angles[2]) < 2 || Math.abs(angles[1] - angles[3]) < 2) this.result += 'Diamond'
          else if (angles.filter(el => Math.abs(90 - el) < 2).length === 2) this.result += 'Right-angle trapezoid'
          else if (Math.abs(d1 - d2) < 3) this.result += 'Isosceles trapezoid'
          else this.result += 'Trapezoid'
        } else if (angles.length > 4 && angles.length <= 9) {
          this.result += `${angles.length} angle figure`
        }
      } else {
        this.result = ''
        if (
          Math.abs(srcCanvas.height - srcCanvas.width) < 2
        ) this.result += 'Circle'
        else this.result += 'Ellipse'
      }

      cv.imshow('openCvCanvas', imgColor)
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
        regionCanvas.height = vector.height + 20
        regionCanvas.width = vector.width + 20
        regionCtx.putImageData(vector, 10, 10)

        // CV module loads in async. Better to check, if it's ready
        if (cv) {
          this.canvasToCvToCanvas()
        }

        this.loading = false
      }, 100)
    },
    sliderChange () {
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