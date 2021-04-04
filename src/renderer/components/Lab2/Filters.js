function toGrayscale (srcCanvas, srcCtx, destCanvas, destCtx) {
  const { width, height } = srcCanvas
  const imageData = srcCtx.getImageData(0, 0, width, height)
  const background = [ imageData.data[width * 1 + 4], imageData.data[width * 1 + 5], imageData.data[width * 1 + 6] ]
  const threshold = 20

  for (let i = 0; i < imageData.data.length; i += 4) {
    /*
    const intensity = parseInt(0.299 * imageData.data[i] + 0.587 * imageData.data[i + 1] + 0.114 * imageData.data[i + 2])
    imageData.data[i] = intensity
    imageData.data[i + 1] = intensity
    imageData.data[i + 2] = intensity
    imageData.data[i + 3] = 255
    */
    if (
      Math.abs(imageData.data[i] - background[0]) <= threshold &&
      Math.abs(imageData.data[i + 1] - background[1]) <= threshold &&
      Math.abs(imageData.data[i + 2] - background[2]) <= threshold
    ) {
      imageData.data[i] = 255
      imageData.data[i + 1] = 255
      imageData.data[i + 2] = 255
      imageData.data[i + 3] = 255
    } else {
      imageData.data[i] = 0
      imageData.data[i + 1] = 0
      imageData.data[i + 2] = 0
      imageData.data[i + 3] = 255
    }
  }

  destCanvas.width = width
  destCanvas.height = height
  destCtx.putImageData(imageData, 0, 0)
}

module.exports = {
  toGrayscale
}
