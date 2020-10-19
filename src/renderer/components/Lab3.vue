<template>
    <div class="lab3">
        <div class="overlay-dark" v-show="loading">
            <div class="spinner-border" role="status">
                <span class="sr-only">Loading...</span>
            </div>
        </div>
        <div class="row">
            <div class="col-4">
              <h4>Click to add image</h4>
              <hr>
            </div>
            <div class="col-4">
              <h4>Histogram Equalization</h4>
              <input type="range" min="0" max="255" step="1" v-model="scale" style="width: 100%;"> 
            </div>
            <div class="col-4">
              <h4>Another algorithm</h4>
              <div class="flex-align">
                Th: <input type="number" @change="debounceScale" min="0" max="1" v-model="advancedTh" style="width: 40%;"> 
                C: <input type="number" @change="debounceScale" min="0" max="100" v-model="advancedC" style="width: 40%;">
              </div>
            </div>
        </div>
        <div class="row">
            <div class="col-4">
                <canvas class="hover"
                    @click="openImage"
                    ref="canvasMain"
                    width="200"
                    height="100"
                ></canvas>
                <apexchart type="area" :options="options" :series="series"></apexchart>
            </div>
            <div class="col-4">
                <canvas
                    ref="canvasAlgorithmBase"
                    width="200"
                    height="100"
                ></canvas>
                <apexchart type="area" :options="options" :series="seriesBase"></apexchart>
            </div>
            <div class="col-4">
                <canvas
                    ref="canvasAlgorithmAnother"
                    width="200"
                    height="100"
                ></canvas>
                <apexchart type="area" :options="options" :series="seriesAnother"></apexchart>
            </div>
        </div>
    </div>
</template>

<script>
const Jimp = require('jimp')
const { dialog } = require('electron').remote
const { debounce } = require('lodash')

let CONTEXT_WEAKMAP = null

const modifiedSigmoid = (pixel, C, Th) => (1 / (1 + Math.pow(Math.E, C * (Th - pixel / 255.0)))) * 255.0

export default {
  name: 'lab3',
  data () {
    return {
      loading: false,
      scale: 200,
      advancedC: 10,
      advancedTh: 0.3,
      options: {
        colors: ['#f00', '#0f0', '#00f', '#777'],
        chart: {
          id: 'vuechart-example'
        },
        dataLabels: {
          enabled: false
        },
        xaxis: {
          labels: {
            show: false
          }
        }
      },
      series: [{
        name: 'Main Image',
        data: new Array(256).fill(0)
      }],
      seriesBase: [{
        name: 'Main Image',
        data: new Array(256).fill(0)
      }],
      seriesAnother: [{
        name: 'Main Image',
        data: new Array(256).fill(0)
      }]
    }
  },
  mounted () {
    CONTEXT_WEAKMAP = new WeakMap()
    CONTEXT_WEAKMAP.set(this.$refs.canvasMain, this.$refs.canvasMain.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasAlgorithmBase, this.$refs.canvasAlgorithmBase.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasAlgorithmAnother, this.$refs.canvasAlgorithmAnother.getContext('2d'))
  },
  methods: {
    debounceScale: debounce(function () { this.performAlgorithms() }, 300),
    performAlgorithms () {
      const canvasMain = this.$refs.canvasMain
      const ctxMain = CONTEXT_WEAKMAP.get(canvasMain)
      const mainImageHistoSeries = this.getHistoSeries(canvasMain, ctxMain)
      this.series = [{
        name: 'Red',
        data: mainImageHistoSeries.R
      }, {
        name: 'Green',
        data: mainImageHistoSeries.G
      }, {
        name: 'Blue',
        data: mainImageHistoSeries.B
      }, {
        name: 'Intensity',
        data: mainImageHistoSeries.I
      }]
      const iHisto = mainImageHistoSeries.I
      const iTotal = iHisto.reduce((acc, now) => acc + now)
      const iNorm = iHisto.map((el) => el / iTotal)
      const functionCumulativeSum = (sum => value => { sum += value; return sum })(0)
      const iCummulative = iNorm.map(functionCumulativeSum)
      const iCummulativeScaled = iCummulative.map(el => Math.floor(el * this.scale))

      const { width, height } = canvasMain
      let buffer = ctxMain.getImageData(0, 0, width, height)
      for (let i = 0; i < buffer.data.length; i += 4) {
        const intensity = parseInt(0.299 * buffer.data[i] + 0.587 * buffer.data[i + 1] + 0.114 * buffer.data[i + 2])
        const scale = iCummulativeScaled[intensity] / intensity
        buffer.data[i] *= scale
        buffer.data[i + 1] *= scale
        buffer.data[i + 2] *= scale
      }
      const canvasBase = this.$refs.canvasAlgorithmBase
      const ctxBase = CONTEXT_WEAKMAP.get(canvasBase)
      canvasBase.width = canvasMain.width
      canvasBase.height = canvasMain.height
      ctxBase.putImageData(buffer, 0, 0)

      const baseImageHistoSeries = this.getHistoSeries(canvasBase, ctxBase)
      this.seriesBase = [{
        name: 'Red',
        data: baseImageHistoSeries.R
      }, {
        name: 'Green',
        data: baseImageHistoSeries.G
      }, {
        name: 'Blue',
        data: baseImageHistoSeries.B
      }, {
        name: 'Intensity',
        data: baseImageHistoSeries.I
      }]

      // Advanced algorithm
      buffer = ctxMain.getImageData(0, 0, width, height)
      const C = this.advancedC
      const Th = this.advancedTh
      for (let i = 0; i < buffer.data.length; i += 4) {
        buffer.data[i] = modifiedSigmoid(buffer.data[i], C, Th)
        buffer.data[i + 1] = modifiedSigmoid(buffer.data[i + 1], C, Th)
        buffer.data[i + 2] = modifiedSigmoid(buffer.data[i + 2], C, Th)
      }
      const canvasAdvanced = this.$refs.canvasAlgorithmAnother
      const ctxAdvanced = CONTEXT_WEAKMAP.get(canvasAdvanced)
      canvasAdvanced.width = canvasMain.width
      canvasAdvanced.height = canvasMain.height
      ctxAdvanced.putImageData(buffer, 0, 0)

      const advancedImageHistoSeries = this.getHistoSeries(canvasAdvanced, ctxAdvanced)
      this.seriesAnother = [{
        name: 'Red',
        data: advancedImageHistoSeries.R
      }, {
        name: 'Green',
        data: advancedImageHistoSeries.G
      }, {
        name: 'Blue',
        data: advancedImageHistoSeries.B
      }, {
        name: 'Intensity',
        data: advancedImageHistoSeries.I
      }]
    },
    getHistoSeries (canvas, context) {
      const colors = {
        R: new Array(256).fill(0),
        G: new Array(256).fill(0),
        B: new Array(256).fill(0),
        I: new Array(256).fill(0)
      }
      const { width, height } = canvas
      const buffer = context.getImageData(0, 0, width, height)

      for (let i = 0; i < buffer.data.length; i += 4) {
        const intensity = parseInt(0.299 * buffer.data[i] + 0.587 * buffer.data[i + 1] + 0.114 * buffer.data[i + 2])
        colors.R[buffer.data[i]]++
        colors.G[buffer.data[i + 1]]++
        colors.B[buffer.data[i + 2]]++
        colors.I[intensity]++
      }
      colors.R[0] = 0
      colors.G[0] = 0
      colors.B[0] = 0
      colors.I[0] = 0
      return colors
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
  }
</style>