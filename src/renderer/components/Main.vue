<template>
  <div class="mainpage">
    <h4>Click on canvas to add image</h4>
    <canvas @click="openImage1" ref="canvas1" width="200" height="100"></canvas>
    <canvas @click="openImage2" ref="canvas2" width="200" height="100"></canvas>
    <h5>Heat map</h5>
    <canvas ref="heat" width="200" height="100"></canvas>
    <button @click="performAvgCubicError">Average square error</button>
    <button @click="performMaxError">Max error</button>
    <p>Result: {{ result }}</p>
  </div>
</template>

<script>
const Jimp = require('jimp')
const { dialog } = require('electron').remote
let ctx1 = null
let ctx2 = null

export default {
  name: 'mainpage',
  data () {
    return {
      result: 'no data'
    }
  },
  methods: {
    performAvgCubicError () {
      if (!ctx1 || !ctx2) return
      const { width, height } = this.$refs.canvas1
      const img1 = ctx1.getImageData(0, 0, width, height).data
      const img2 = ctx2.getImageData(0, 0, width, height).data

      const heatImg = ctx1.getImageData(0, 0, width, height)

      let totalDiff = 0
      for (let i = 0; i < img1.length; i += 4) {
        const pixelSquareDiff = Math.pow(img1[i] - img2[i], 2)
        totalDiff += pixelSquareDiff
        const mappedColor = parseInt(pixelSquareDiff / 65025.0 * 255.0)
        heatImg.data[i] = 255
        heatImg.data[i + 1] = 255 - mappedColor
        heatImg.data[i + 2] = 255 - mappedColor
        heatImg.data[i + 3] = 255
      }
      this.result = totalDiff / img1.length
      this.$refs.heat.width = heatImg.width
      this.$refs.heat.height = heatImg.height
      this.$refs.heat.getContext('2d').putImageData(heatImg, 0, 0)
    },
    performMaxError () {
      if (!ctx1 || !ctx2) return
      const { width, height } = this.$refs.canvas1
      const img1 = ctx1.getImageData(0, 0, width, height).data
      const img2 = ctx2.getImageData(0, 0, width, height).data

      let total = 0
      for (let i = 0; i < img1.length; i += 4) {
        const pixelDiff = Math.abs(img1[i] - img2[i])
        total = total > pixelDiff ? total : pixelDiff
      }
      this.result = total
    },
    openImage1 () {
      const path = this.getFile()
      ctx1 = this.$refs.canvas1.getContext('2d')
      Jimp.read(path[0], (err, image) => {
        if (err) throw err
        image.getBase64(Jimp.MIME_JPEG, (err, data) => {
          if (err) throw err
          const img = new Image()
          img.src = data
          img.onload = () => {
            this.$refs.canvas1.width = img.width
            this.$refs.canvas1.height = img.height
            ctx1.drawImage(img, 0, 0)
            const img1 = ctx1.getImageData(0, 0, img.width, img.height)
            for (let i = 0; i < img1.data.length; i += 4) {
              const intensity = parseInt(0.299 * img1.data[i] + 0.587 * img1.data[i + 1] + 0.114 * img1.data[i + 2])
              img1.data[i] = intensity
              img1.data[i + 1] = intensity
              img1.data[i + 2] = intensity
              img1.data[i + 3] = 255
            }
            ctx1.putImageData(img1, 0, 0)
          }
        })
      })
    },
    openImage2 () {
      const path = this.getFile()
      ctx2 = this.$refs.canvas2.getContext('2d')
      Jimp.read(path[0], (err, image) => {
        if (err) throw err
        image.getBase64(Jimp.MIME_JPEG, (err, data) => {
          if (err) throw err
          const img = new Image()
          img.src = data
          img.onload = () => {
            this.$refs.canvas2.width = img.width
            this.$refs.canvas2.height = img.height
            ctx2.drawImage(img, 0, 0)
            const img1 = ctx2.getImageData(0, 0, img.width, img.height)
            for (let i = 0; i < img1.data.length; i += 4) {
              const intensity = parseInt(0.299 * img1.data[i] + 0.587 * img1.data[i + 1] + 0.114 * img1.data[i + 2])
              img1.data[i] = intensity
              img1.data[i + 1] = intensity
              img1.data[i + 2] = intensity
              img1.data[i + 3] = 255
            }
            ctx2.putImageData(img1, 0, 0)
          }
        })
      })
    },
    getFile () {
      return dialog.showOpenDialog({ properties: ['openFile'] })
    }
  }
}
</script>

<style scoped>
  canvas {
    border: 1px solid black;
    display: inline-block;
    width: 49%;
  }
</style>