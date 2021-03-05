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
      <div class='col-4 hide-from-user'>
        <h4>Extracted region</h4>
      </div>
      <div class='col-4'>
        <h4>Matching template</h4>
      </div>
      <div class='col-4 hide-from-user'>
        <h4>Template</h4>
      </div>
    </div>
    <div class='row'>
      <div class='col-4 hide-from-user'>
        <canvas ref='extractedRegion' width='200' height='100'></canvas>
      </div>
      <div class='col-4'>
        <canvas ref='matchedPattern' width='200' height='100'></canvas>
      </div>
      <div class='col-4 hide-from-user'>
        <canvas ref='templateCanvas' width='200' height='100'></canvas>
      </div>
      <div class='col-4'>
        <div id='pat-1' ref='pat1'></div>
        <div id='pat-2' ref='pat2'></div>
        <div id='pat-3' ref='pat3'></div>
      </div>
    </div>
    <button @click='loadDirectory'>Select template images</button>
    <button @click='compareRegionTemplates'>Compare Images</button>
  </div>
</template>

<script>
const Jimp = require('jimp')
const fs = require('fs')
const { join } = require('path')
const { dialog } = require('electron').remote
// const { some } = require('lodash')

let CONTEXT_WEAKMAP = null
let REGION_BOUNDARIES = null
let EXTRACTED_REGION_DATA = null

export default {
  name: 'lab1',
  data () {
    return {
      loading: false,
      templateFiles: null
    }
  },
  mounted () {
    CONTEXT_WEAKMAP = new WeakMap()
    CONTEXT_WEAKMAP.set(this.$refs.canvasMain, this.$refs.canvasMain.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasRegion, this.$refs.canvasRegion.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.canvasSelectedObject, this.$refs.canvasSelectedObject.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.templateCanvas, this.$refs.templateCanvas.getContext('2d'))
    CONTEXT_WEAKMAP.set(this.$refs.matchedPattern, this.$refs.matchedPattern.getContext('2d'))
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
      canvasSelectedObject.width = width; canvasSelectedObject.height = height
      ctxSelectedObject.putImageData(regionImageData, 0, 0)

      // Calculating last region's dimensions
      let regWidth = REGION_BOUNDARIES.x_max - REGION_BOUNDARIES.x_min + 1
      let regHeight = REGION_BOUNDARIES.y_max - REGION_BOUNDARIES.y_min + 1

      // Extracting pixels that belongs to the selected region
      EXTRACTED_REGION_DATA = this.extractRegion(regionImageData, width, height, regWidth, regHeight)

      // Drawing region on the canvas
      let regCanvas = this.$refs.extractedRegion
      let regCanvasCtx = regCanvas.getContext('2d')
      regCanvas.height = height; regCanvas.width = width
      regCanvasCtx.putImageData(EXTRACTED_REGION_DATA, 0, 0)
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
    async openImage () {
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
      await this.loadFromPathToCanvas(canvas, path[0])
      this.convertToGrayscale(canvas, this.$refs.canvasRegion)
      this.loading = false
    },
    loadFromPathToCanvas (canvas, path) {
      return new Promise((resolve, reject) => {
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
              resolve()
            }
          })
          .catch(e => {
            this.loading = false
            console.error(e)
            reject(e)
          })
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
    },
    loadDirectory () {
      const [folderPath] = dialog.showOpenDialog({ properties: ['openDirectory'] })
      this.templateFiles = fs.readdirSync(folderPath)
        .filter(el => el.includes('.png'))
        .map(el => join(folderPath, el))
    },
    async compareRegionTemplates () {
      // If either directory or region in the image wasn't selected
      if (!this.templateFiles || !EXTRACTED_REGION_DATA) {
        return
      }

      let cpResults = []
      let tplCanvas = this.$refs.templateCanvas
      let regCanvas = this.$refs.matchedPattern
      let regRescld = null // Holds region data after rescale

      for (let i = 0; i < this.templateFiles.length; i++) {
        await this.loadFromPathToCanvas(tplCanvas, this.templateFiles[i]).then(
          () => {
            let regHeight = REGION_BOUNDARIES.y_max - REGION_BOUNDARIES.y_min + 1
            let regWidth = REGION_BOUNDARIES.x_max - REGION_BOUNDARIES.x_min + 1
            let tmpHeight = tplCanvas.height; let tmpWidth = tplCanvas.width
            let tmpImgData = new ImageData(tmpWidth, tmpHeight)

            // Filling in the empty template with white color and maximum alpha values
            for (let i = 0; i < tmpImgData.data.length; i++) {
              tmpImgData.data[i] = 255
            }

            //
            // Resizing extracted region saving it's aspect ratio, so it could
            // fit into borders  of  template image,  then centering it within
            // white image which size is equal to template image's size.
            //
            if (tmpWidth === tmpHeight) {
              if (regWidth === regHeight) {
                regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tmpWidth, tmpHeight)
                for (let i2 = 0; i2 < regRescld.data.length; i2 += 4) {
                  if (regRescld.data[i2] === 0 && regRescld.data[i2 + 1] === 255 && regRescld.data[i2 + 2] === 0) {
                    /* R */ tmpImgData.data[i2 + 0] = 0
                    /* G */ tmpImgData.data[i2 + 1] = 0
                    /* B */ tmpImgData.data[i2 + 2] = 0
                  } else {
                    /* R */ tmpImgData.data[i2 + 0] = 255
                    /* G */ tmpImgData.data[i2 + 1] = 255
                    /* B */ tmpImgData.data[i2 + 2] = 255
                  }
                }
              } else if (regWidth > regHeight) {
                let tgtHeight = Math.round(tmpWidth / (regWidth / regHeight))
                let heightOffset = Math.round((tmpHeight - tgtHeight) / 2)

                regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tmpWidth, tgtHeight)
                for (let i2 = tmpWidth * heightOffset * 4, i3 = 0; i3 < regRescld.data.length; i3 += 4, i2 += 4) {
                  if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                    /* R */ tmpImgData.data[i2 + 0] = 0
                    /* G */ tmpImgData.data[i2 + 1] = 0
                    /* B */ tmpImgData.data[i2 + 2] = 0
                  } else {
                    /* R */ tmpImgData.data[i2 + 0] = 255
                    /* G */ tmpImgData.data[i2 + 1] = 255
                    /* B */ tmpImgData.data[i2 + 2] = 255
                  }
                }
              } else if (regWidth < regHeight) {
                let tgtWidth = Math.round(tmpHeight / (regHeight / regWidth))
                let widthOffset = Math.round((tmpWidth - tgtWidth) / 2)

                regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tgtWidth, tmpHeight)
                for (let i2 = 0; i2 < tmpHeight; i2++) {
                  for (let i3 = i2 * tgtWidth * 4, i4 = (i2 * tmpWidth * 4) + (widthOffset * 4), i5 = 0; i5 < tgtWidth; i5++, i4 += 4, i3 += 4) {
                    if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                      /* R */ tmpImgData.data[i4 + 0] = 0
                      /* G */ tmpImgData.data[i4 + 1] = 0
                      /* B */ tmpImgData.data[i4 + 2] = 0
                    } else {
                      /* R */ tmpImgData.data[i4 + 0] = 255
                      /* G */ tmpImgData.data[i4 + 1] = 255
                      /* B */ tmpImgData.data[i4 + 2] = 255
                    }
                  }
                }
              }
            } else if (tmpWidth > tmpHeight) {
              if (regWidth === regHeight) {
                let tgtWidth = Math.round(tmpHeight / (regHeight / regWidth))
                let widthOffset = Math.round((tmpWidth - tgtWidth) / 2)

                regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tgtWidth, tmpHeight)
                for (let i2 = 0; i2 < tmpHeight; i2++) {
                  for (let i3 = i2 * tgtWidth * 4, i4 = (i2 * tmpWidth * 4) + (widthOffset * 4), i5 = 0; i5 < tgtWidth; i5++, i4 += 4, i3 += 4) {
                    if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                      /* R */ tmpImgData.data[i4 + 0] = 0
                      /* G */ tmpImgData.data[i4 + 1] = 0
                      /* B */ tmpImgData.data[i4 + 2] = 0
                    } else {
                      /* R */ tmpImgData.data[i4 + 0] = 255
                      /* G */ tmpImgData.data[i4 + 1] = 255
                      /* B */ tmpImgData.data[i4 + 2] = 255
                    }
                  }
                }
              } else if (regWidth > regHeight) {
                let tgtHeight = Math.round(tmpWidth / (regWidth / regHeight))
                let heightOffset = Math.round((tmpHeight - tgtHeight) / 2)

                if (tgtHeight > tmpHeight) {
                  let tgtWidth = Math.round(tmpHeight / (regHeight / regWidth))
                  let widthOffset = Math.round((tmpWidth - tgtWidth) / 2)

                  regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tgtWidth, tmpHeight)
                  for (let i2 = 0; i2 < tmpHeight; i2++) {
                    for (let i3 = i2 * tgtWidth * 4, i4 = (i2 * tmpWidth * 4) + (widthOffset * 4), i5 = 0; i5 < tgtWidth; i5++, i4 += 4, i3 += 4) {
                      if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                        /* R */ tmpImgData.data[i4 + 0] = 0
                        /* G */ tmpImgData.data[i4 + 1] = 0
                        /* B */ tmpImgData.data[i4 + 2] = 0
                      } else {
                        /* R */ tmpImgData.data[i4 + 0] = 255
                        /* G */ tmpImgData.data[i4 + 1] = 255
                        /* B */ tmpImgData.data[i4 + 2] = 255
                      }
                    }
                  }
                } else {
                  regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tmpWidth, tgtHeight)
                  for (let i2 = tmpWidth * heightOffset * 4, i3 = 0; i3 < regRescld.data.length; i3 += 4, i2 += 4) {
                    if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                      /* R */ tmpImgData.data[i2 + 0] = 0
                      /* G */ tmpImgData.data[i2 + 1] = 0
                      /* B */ tmpImgData.data[i2 + 2] = 0
                    } else {
                      /* R */ tmpImgData.data[i2 + 0] = 255
                      /* G */ tmpImgData.data[i2 + 1] = 255
                      /* B */ tmpImgData.data[i2 + 2] = 255
                    }
                  }
                }
              } else if (regWidth < regHeight) {
                let tgtWidth = Math.round(tmpHeight / (regHeight / regWidth))
                let widthOffset = Math.round((tmpWidth - tgtWidth) / 2)

                regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tgtWidth, tmpHeight)
                for (let i2 = 0; i2 < tmpHeight; i2++) {
                  for (let i3 = i2 * tgtWidth * 4, i4 = (i2 * tmpWidth * 4) + (widthOffset * 4), i5 = 0; i5 < tgtWidth; i5++, i4 += 4, i3 += 4) {
                    if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                      /* R */ tmpImgData.data[i4 + 0] = 0
                      /* G */ tmpImgData.data[i4 + 1] = 0
                      /* B */ tmpImgData.data[i4 + 2] = 0
                    } else {
                      /* R */ tmpImgData.data[i4 + 0] = 255
                      /* G */ tmpImgData.data[i4 + 1] = 255
                      /* B */ tmpImgData.data[i4 + 2] = 255
                    }
                  }
                }
              }
            } else if (tmpWidth < tmpHeight) {
              if (regWidth === regHeight) {
                let tgtHeight = Math.round(tmpWidth / (regWidth / regHeight))
                let heightOffset = Math.round((tmpHeight - tgtHeight) / 2)

                regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tmpWidth, tgtHeight)
                for (let i2 = tmpWidth * heightOffset * 4, i3 = 0; i3 < regRescld.data.length; i3 += 4, i2 += 4) {
                  if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                    /* R */ tmpImgData.data[i2 + 0] = 0
                    /* G */ tmpImgData.data[i2 + 1] = 0
                    /* B */ tmpImgData.data[i2 + 2] = 0
                  } else {
                    /* R */ tmpImgData.data[i2 + 0] = 255
                    /* G */ tmpImgData.data[i2 + 1] = 255
                    /* B */ tmpImgData.data[i2 + 2] = 255
                  }
                }
              } else if (regWidth > regHeight) {
                let tgtHeight = Math.round(tmpWidth / (regWidth / regHeight))
                let heightOffset = Math.round((tmpHeight - tgtHeight) / 2)

                regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tmpWidth, tgtHeight)
                for (let i2 = tmpWidth * heightOffset * 4, i3 = 0; i3 < regRescld.data.length; i3 += 4, i2 += 4) {
                  if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                    /* R */ tmpImgData.data[i2 + 0] = 0
                    /* G */ tmpImgData.data[i2 + 1] = 0
                    /* B */ tmpImgData.data[i2 + 2] = 0
                  } else {
                    /* R */ tmpImgData.data[i2 + 0] = 255
                    /* G */ tmpImgData.data[i2 + 1] = 255
                    /* B */ tmpImgData.data[i2 + 2] = 255
                  }
                }
              } else if (regWidth < regHeight) {
                let tgtWidth = Math.round(tmpHeight / (regHeight / regWidth))
                let widthOffset = Math.round((tmpWidth - tgtWidth) / 2)

                if (tgtWidth > tmpWidth) {
                  let tgtHeight = Math.round(tmpWidth / (regWidth / regHeight))
                  let heightOffset = Math.round((tmpHeight - tgtHeight) / 2)

                  regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tmpWidth, tgtHeight)
                  for (let i2 = tmpWidth * heightOffset * 4, i3 = 0; i3 < regRescld.data.length; i3 += 4, i2 += 4) {
                    if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                      /* R */ tmpImgData.data[i2 + 0] = 0
                      /* G */ tmpImgData.data[i2 + 1] = 0
                      /* B */ tmpImgData.data[i2 + 2] = 0
                    } else {
                      /* R */ tmpImgData.data[i2 + 0] = 255
                      /* G */ tmpImgData.data[i2 + 1] = 255
                      /* B */ tmpImgData.data[i2 + 2] = 255
                    }
                  }
                } else {
                  regRescld = this.resizeImage(EXTRACTED_REGION_DATA, regWidth, regHeight, tgtWidth, tmpHeight)
                  for (let i2 = 0; i2 < tmpHeight; i2++) {
                    for (let i3 = i2 * tgtWidth * 4, i4 = (i2 * tmpWidth * 4) + (widthOffset * 4), i5 = 0; i5 < tgtWidth; i5++, i4 += 4, i3 += 4) {
                      if (regRescld.data[i3] === 0 && regRescld.data[i3 + 1] === 255 && regRescld.data[i3 + 2] === 0) {
                        /* R */ tmpImgData.data[i4 + 0] = 0
                        /* G */ tmpImgData.data[i4 + 1] = 0
                        /* B */ tmpImgData.data[i4 + 2] = 0
                      } else {
                        /* R */ tmpImgData.data[i4 + 0] = 255
                        /* G */ tmpImgData.data[i4 + 1] = 255
                        /* B */ tmpImgData.data[i4 + 2] = 255
                      }
                    }
                  }
                }
              }
            }

            let tp = 0; let tn = 0; let fp = 0; let fn = 0
            let tplImgData = tplCanvas.getContext('2d').getImageData(0, 0, tmpWidth, tmpHeight)
            for (let i2 = 0; i2 < tplImgData.data.length; i2 += 4) {
              if /* Template (black)    Region (black) */ (
                (tplImgData.data[i2 + 0] === 0 && tmpImgData.data[i2 + 0] === 0) &&
                (tplImgData.data[i2 + 1] === 0 && tmpImgData.data[i2 + 1] === 0) &&
                (tplImgData.data[i2 + 2] === 0 && tmpImgData.data[i2 + 2] === 0)
              ) {
                tp++
              } else if /* Template (white)    Region (white) */ (
                (tplImgData.data[i2 + 0] === 255 && tmpImgData.data[i2 + 0] === 255) &&
                (tplImgData.data[i2 + 1] === 255 && tmpImgData.data[i2 + 1] === 255) &&
                (tplImgData.data[i2 + 2] === 255 && tmpImgData.data[i2 + 2] === 255)
              ) {
                tn++
              } else if /* Template (white)    Region (black) */ (
                (tplImgData.data[i2 + 0] === 255 && tmpImgData.data[i2 + 0] === 0) &&
                (tplImgData.data[i2 + 1] === 255 && tmpImgData.data[i2 + 1] === 0) &&
                (tplImgData.data[i2 + 2] === 255 && tmpImgData.data[i2 + 2] === 0)
              ) {
                fp++
              } else if /* Template (black)    Region (white) */ (
                (tplImgData.data[i2 + 0] === 0 && tmpImgData.data[i2 + 0] === 255) &&
                (tplImgData.data[i2 + 1] === 0 && tmpImgData.data[i2 + 1] === 255) &&
                (tplImgData.data[i2 + 2] === 0 && tmpImgData.data[i2 + 2] === 255)
              ) {
                fn++
              }
            }

            // (TP + TN)/(TP + TN + FP + FN)
            let result = (tp + tn) / (tp + tn + fp + fn)
            cpResults.push([ this.templateFiles[i], result ])
          }
        )
      }

      let bestPath = null
      let bestMatches = []
      for (let i = 0, j = 0, max = [0, 0]; i < cpResults.length; i++) {
        if (cpResults[i][1] > max[1]) {
          max = cpResults[i]
          j = i
        }

        if (i === cpResults.length - 1) {
          if (!bestPath) {
            bestPath = max[0]
          }

          bestMatches.push([ max[0].substring(max[0].lastIndexOf('\\') + 1, max[0].length), (max[1] * 100).toFixed(2) ])
          cpResults.splice(j, 1)
          max = [0, 0]
          j = 0

          if (bestMatches.length === 3) {
            break
          } else {
            i = 0
          }
        }
      }

      await this.loadFromPathToCanvas(regCanvas, bestPath)
      this.$refs.pat1.innerHTML = '&#10004;&nbsp;' + bestMatches[0][0] + '&nbsp;match for:&nbsp;' + bestMatches[0][1] + '%'

      if (bestMatches.length > 1) {
        this.$refs.pat2.innerHTML = '&#9899;&nbsp;' + bestMatches[1][0] + '&nbsp;match for:&nbsp;' + bestMatches[1][1] + '%'
      }

      if (bestMatches.length > 2) {
        this.$refs.pat3.innerHTML = '&#9899;&nbsp;' + bestMatches[2][0] + '&nbsp;match for:&nbsp;' + bestMatches[2][1] + '%'
      }
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
  .hide-from-user {
    display: none;
  }
  #pat-1, #pat-2, #pat-3 {
    margin-top: 5px;
  }
  #pat-1 {
    color: #00AA00;
  }
</style>