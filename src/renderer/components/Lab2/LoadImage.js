const { toGrayscale } = require('./Filters')

const Jimp = require('jimp')

async function openImage (path, coloredCanvas, grayscaleCanvas) {
  if (!coloredCanvas || !grayscaleCanvas) {
    throw new Error('No canvas element found')
  }
  if (!path) {
    throw new Error('Path not selected')
  }
  const coloredCtx = coloredCanvas.getContext('2d')
  const grayscaleCtx = grayscaleCanvas.getContext('2d')
  await loadFromPathToCanvas(coloredCanvas, coloredCtx, path[0])
  toGrayscale(coloredCanvas, coloredCtx, grayscaleCanvas, grayscaleCtx)
}

function loadFromPathToCanvas (canvas, ctx, path) {
  return new Promise((resolve, reject) => {
    if (!ctx) return
    getImageBase64(path)
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
        reject(e)
      })
  })
}

function getImageBase64 (path) {
  return new Promise((resolve, reject) => {
    Jimp.read(path, (err, image) => {
      if (err) reject(err)
      image.getBase64(Jimp.MIME_JPEG, (err, data) => {
        if (err) reject(err)
        resolve(data)
      })
    })
  })
}

export default {
  openImage
}
