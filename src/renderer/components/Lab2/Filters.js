function toGrayscale (srcCanvas, srcCtx, destCanvas, destCtx) {
  const { width, height } = srcCanvas
  const imageData = srcCtx.getImageData(0, 0, width, height)
  for (let i = 0; i < imageData.data.length; i += 4) {
    const intensity = parseInt(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2])
    imageData.data[i] = intensity
    imageData.data[i + 1] = intensity
    imageData.data[i + 2] = intensity
    imageData.data[i + 3] = 255
  }
  destCanvas.width = width
  destCanvas.height = height
  destCtx.putImageData(imageData, 0, 0)
}

module.exports = {
  toGrayscale
}
