<template>
  <div class="mainpage">
    <div class="row">
      <div class="col-8">
    <h3>Click on canvas to add image</h3>
      </div>
      <div class="col-4">
        <h4>Actions</h4>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <canvas class="hover" @click="openImage" ref="canvas1" width="200" height="100"></canvas>
      </div>
      <div class="col-4">
        <canvas class="hover" @click="openImage" ref="canvas2" width="200" height="100"></canvas>
      </div>
      <div class="col-4">
        <button class="btn btn-primary" @click="performAvgSquareError">Avg square error</button>
        <span>Result: {{ resultAvgSquareError }}</span><hr>
        <button class="btn btn-primary" @click="performMaxError">Max error</button>
        <span>Result: {{ resultMaxError }}</span>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <h4>Heat map</h4>
      </div>
      <div class="col-4">
        <h4>Heat map opacity overlay</h4>
      </div>
    </div>
    <div class="row">
      <div class="col-4">
        <canvas ref="canvasHeat" width="200" height="100"></canvas>
      </div>
      <div class="col-4">
        <canvas ref="canvasHeatOverlay" width="200" height="100"></canvas>
      </div>
    </div>
  </div>
</template>

<script>
const Jimp = require('jimp')
const { dialog } = require('electron').remote

let CONTEXT_WEAKMAP = null

const HEATMAP_OVERLAY_ALPHA = 0.6

export default {
  name: 'mainpage',
  data () {
    return {
      resultAvgSquareError: 'no data',
      resultMaxError: 'no data'
    }
  },
  mounted () {
    CONTEXT_WEAKMAP = new WeakMap()
    CONTEXT_WEAKMAP.set(this.$refs.canvas1, this.$refs.canvas1.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvas2, this.$refs.canvas2.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasHeat, this.$refs.canvasHeat.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasHeatOverlay, this.$refs.canvasHeatOverlay.getContext('2d'))
  },
  methods: {
    performAvgSquareError () {
      if (!this.isImageSizeEqual()) return
      if (!CONTEXT_WEAKMAP) return
      const ctx1 = CONTEXT_WEAKMAP.get(this.$refs.canvas1)
      const ctx2 = CONTEXT_WEAKMAP.get(this.$refs.canvas2)
      const ctxHeat = CONTEXT_WEAKMAP.get(this.$refs.canvasHeat)
      const ctxHeatOverlay = CONTEXT_WEAKMAP.get(this.$refs.canvasHeatOverlay)
      if (!ctx1 || !ctx2 || !ctxHeat || !ctxHeatOverlay) return

      const { width, height } = this.$refs.canvas1
      const imageData1 = ctx1.getImageData(0, 0, width, height).data
      const imageData2 = ctx2.getImageData(0, 0, width, height).data
      const imageDataHeat = ctx1.getImageData(0, 0, width, height)
      const imageDataHeatOverlay = ctx1.getImageData(0, 0, width, height)

      let totalDiff = 0
      for (let i = 0; i < imageData1.length; i += 4) {
        const pixelSquareDiff = Math.pow(imageData1[i] - imageData2[i], 2)
        totalDiff += pixelSquareDiff

        const mappedColor = parseInt(pixelSquareDiff / 65025.0 * 255.0)
        imageDataHeat.data[i] = mappedColor
        imageDataHeat.data[i + 1] = 255 - mappedColor
        imageDataHeat.data[i + 2] = 0
        imageDataHeat.data[i + 3] = 255

        imageDataHeatOverlay[i] = imageData1[i]
        if (mappedColor !== 0) {
          imageDataHeatOverlay.data[i] = imageDataHeatOverlay.data[i] * HEATMAP_OVERLAY_ALPHA + mappedColor * (1.0 - HEATMAP_OVERLAY_ALPHA)
          imageDataHeatOverlay.data[i + 1] = imageDataHeatOverlay.data[i] * HEATMAP_OVERLAY_ALPHA + (255 - mappedColor) * (1.0 - HEATMAP_OVERLAY_ALPHA)
        }
      }
      this.resultAvgSquareError = (totalDiff / imageData1.length).toFixed(2)

      this.$refs.canvasHeat.width = imageDataHeat.width
      this.$refs.canvasHeat.height = imageDataHeat.height
      ctxHeat.putImageData(imageDataHeat, 0, 0)

      this.$refs.canvasHeatOverlay.width = imageDataHeatOverlay.width
      this.$refs.canvasHeatOverlay.height = imageDataHeatOverlay.height
      ctxHeatOverlay.putImageData(imageDataHeatOverlay, 0, 0)
    },
    performMaxError () {
      if (!this.isImageSizeEqual()) return
      if (!CONTEXT_WEAKMAP) return
      const ctx1 = CONTEXT_WEAKMAP.get(this.$refs.canvas1)
      const ctx2 = CONTEXT_WEAKMAP.get(this.$refs.canvas2)
      if (!ctx1 || !ctx2) return

      const { width, height } = this.$refs.canvas1
      const imageData1 = ctx1.getImageData(0, 0, width, height).data
      const imageData2 = ctx2.getImageData(0, 0, width, height).data

      let maxError = 0
      for (let i = 0; i < imageData1.length; i += 4) {
        const pixelDiff = Math.abs(imageData1[i] - imageData2[i])
        maxError = maxError > pixelDiff ? maxError : pixelDiff
      }
      this.resultMaxError = maxError.toFixed(2)
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
    openImage (event) {
      const path = this.getFilePath()
      if (path.length === 1) {
        const canvas = event.target
        if (!canvas) return
        this.loadFromPathToCanvas(canvas, path[0])
      } else if (path.length === 2) {
        this.loadFromPathToCanvas(this.$refs.canvas1, path[0])
        this.loadFromPathToCanvas(this.$refs.canvas2, path[1])
      } else {
        alert('Maximum files allowed: 2')
      }
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
            const imageData = ctx.getImageData(0, 0, image.width, image.height)
            for (let i = 0; i < imageData.data.length; i += 4) {
              const intensity = parseInt(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2])
              imageData.data[i] = intensity
              imageData.data[i + 1] = intensity
              imageData.data[i + 2] = intensity
              imageData.data[i + 3] = 255
            }
            ctx.putImageData(imageData, 0, 0)
          }
        })
        .catch(e => console.error(e))
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
      return dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'] })
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
</style>