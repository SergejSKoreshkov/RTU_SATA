<template>
  <div class="lab1">
    <!-- Overlay -->
    <div class="overlay-dark" v-show="loading">
      <div class="spinner-border" role="status">
        <span class="sr-only">Loading...</span>
      </div>
    </div>

    <!-- Headings -->
    <div class="row">
      <div class="col-6">
        <h4>Frame</h4>
      </div>
      <div class="col-6">
        <h4>Select region</h4>
      </div>
    </div>

    <!-- Canvas -->
    <div class="row">
      <div class="col-6">
        <video ref="video"></video>
        <button @click="play">play</button>
        <button @click="pause">pause</button>
      </div>

      <div class="col-6">
        <canvas
          ref="canvasMain"
          width="200"
          height="100"
        ></canvas>
      </div>

      <div class="col-6">
        <canvas
          style="cursor: pointer"
          ref="canvasRegion"
          width="200"
          height="100"
          @mousemove="canvasClick"
        ></canvas>
      </div>

      <div class="col-6">
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
let CONTEXT_WEAKMAP = null

export default {
  name: 'lab1',
  data () {
    return {
      loading: false,
      isPlaying: false,
      lastEvent: null
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
      this.lastEvent = event
      // get canvas context and image-data
      const canvas = event.target
      const { width, height } = canvas
      const ctx = CONTEXT_WEAKMAP.get(canvas)
      const imageData = ctx.getImageData(0, 0, width, height)

      // get 'click' x and y
      const size = event.target.getBoundingClientRect()
      const x = Math.trunc((event.clientX - size.left) / size.width * width)
      const y = Math.trunc((event.clientY - size.top) / size.height * height)

      // execute regionGrow on grayscale canvas, first point === click point
      const [regionImageData] = this.regionGrow(canvas, ctx, imageData, { x, y })

      // get canvas for selected region and draw on it
      const canvasSelectedObject = this.$refs.canvasSelectedObject
      const ctxSelectedObject = CONTEXT_WEAKMAP.get(canvasSelectedObject)
      canvasSelectedObject.width = width
      canvasSelectedObject.height = height
      ctxSelectedObject.putImageData(regionImageData, 0, 0)
    },
    regionGrow (canvas, ctx, imageData, point) {
      const { width, height } = canvas
      // Canvas has drawing context
      // This context has image-data, where all pixels are stored
      // Pixel format is RGBA, 8 bit each and stored as one big vector
      // So, imageData.data looks like [r, g, b, a, r, g, b, a, r, g, b, a]
      // You need to convert X and Y to INDEX, to access pixel color
      // Multiplication by 4 is because we have 4 colors - RGBA
      let pixelCoordinates = Math.trunc(width * point.y + point.x) * 4
      const startIntensity = imageData.data[pixelCoordinates]
      const used = new Uint8ClampedArray(width * height * 4)
      const queue = [[point.x, point.y]] // it is a STACK in presentation, but structure is FIFO, so its a queue, not stack :c
      const T = 5 // TODO: slider, not constant

      const resultImageData = new ImageData(width, height)

      while (queue.length !== 0) {
        const [ x, y ] = queue.shift()
        pixelCoordinates = Math.trunc(width * y + x) * 4
        const nowIntensity = imageData.data[pixelCoordinates]
        if (
          startIntensity - T < nowIntensity &&
          startIntensity + T > nowIntensity &&
          !used[pixelCoordinates]
        ) {
          used[pixelCoordinates] = true // fast way to check if pixel is used

          resultImageData.data[pixelCoordinates] = 0
          resultImageData.data[pixelCoordinates + 1] = 255
          resultImageData.data[pixelCoordinates + 2] = 0
          resultImageData.data[pixelCoordinates + 3] = 255

          queue.push([x + 1, y])
          queue.push([x - 1, y])
          queue.push([x, y + 1])
          queue.push([x, y - 1])
        }
      }
      return [resultImageData, imageData]
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
    play () {
      const video = this.$refs.video
      if (this.interval) return
      this.isPlaying = true
      const raf = () => {
        requestAnimationFrame(() => {
          this.setNewFrame()
          if (!this.isPlaying) return
          raf()
        })
      }
      raf()

      window.navigator.mediaDevices.getUserMedia({ audio: false, video: true })
        .then(mediaStream => {
          video.srcObject = mediaStream
          video.onloadedmetadata = () => {
            video.play()
            this.$refs.canvasMain.width = video.videoWidth
            this.$refs.canvasMain.height = video.videoHeight
            this.$refs.canvasRegion.width = video.videoWidth
            this.$refs.canvasRegion.height = video.videoHeight
            this.$refs.canvasSelectedObject.width = video.videoWidth
            this.$refs.canvasSelectedObject.height = video.videoHeight
          }
        })
    },
    pause () {
      const video = this.$refs.video
      video.pause()
      if (!this.interval) return
      this.isPlaying = false
    },
    setNewFrame () {
      const video = this.$refs.video
      CONTEXT_WEAKMAP.get(this.$refs.canvasMain).drawImage(video, 0, 0)
      this.convertToGrayscale(this.$refs.canvasMain, this.$refs.canvasRegion)
      if (this.lastEvent) this.canvasClick(this.lastEvent)
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
  video {
    width: 100%;
  }
</style>