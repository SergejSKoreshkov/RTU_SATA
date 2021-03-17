function regionGrow (t, canvas, imageData, point) {
  const { width, height } = canvas
  let pixelCoordinates = Math.trunc(width * point.y + point.x) * 4
  const startIntensity = imageData.data[pixelCoordinates]
  const used = new Uint8ClampedArray(width * height * 4)
  const stack = [[point.x, point.y]]

  const resultImageData = new ImageData(width, height)
  for (let i = 0; i < resultImageData.data.length; i += 4) {
    resultImageData.data[i] = 0
    resultImageData.data[i + 1] = 0
    resultImageData.data[i + 2] = 0
    resultImageData.data[i + 3] = 255
  }

  const regionBoundaries = {
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
      startIntensity - t < nowIntensity &&
        startIntensity + t > nowIntensity &&
        !used[pixelCoordinates]
    ) {
      used[pixelCoordinates] = true

      resultImageData.data[pixelCoordinates] = 255
      resultImageData.data[pixelCoordinates + 1] = 255
      resultImageData.data[pixelCoordinates + 2] = 255
      resultImageData.data[pixelCoordinates + 3] = 255

      regionBoundaries.x_max = Math.max(regionBoundaries.x_max, x)
      regionBoundaries.x_min = Math.min(regionBoundaries.x_min, x)
      regionBoundaries.y_max = Math.max(regionBoundaries.y_max, y)
      regionBoundaries.y_min = Math.min(regionBoundaries.y_min, y)

      if ((x + 1) < width) stack.push([x + 1, y])

      if ((x - 1) >= 0) stack.push([x - 1, y])

      if ((y + 1) < height) stack.push([x, y + 1])

      if ((y - 1) >= 0) stack.push([x, y - 1])
    }
  }

  return [resultImageData, regionBoundaries]
}

function extractRegion (width, imageData, regionBoundaries) {
  const regWidth = regionBoundaries.x_max - regionBoundaries.x_min + 1
  const regHeight = regionBoundaries.y_max - regionBoundaries.y_min + 1
  let regionData = new ImageData(regWidth, regHeight)

  for (let row = 0; row <= regHeight; row++) {
    for (let col = 0; col <= regWidth; col++) {
      // Translating (X, Y) coordinate to offset within the byte array.
      const pixCoordinatesOriginal = ((regionBoundaries.y_min + row) * width + (regionBoundaries.x_min + col)) * 4
      const pixCoordinates = (row * regWidth + col) * 4

      // Copying bytes from original image to the region's container
      /* R */ regionData.data[pixCoordinates] = imageData.data[pixCoordinatesOriginal]
      /* G */ regionData.data[pixCoordinates + 1] = imageData.data[pixCoordinatesOriginal + 1]
      /* B */ regionData.data[pixCoordinates + 2] = imageData.data[pixCoordinatesOriginal + 2]
      /* A */ regionData.data[pixCoordinates + 3] = imageData.data[pixCoordinatesOriginal + 3]
    }
  }

  return regionData
}

export default {
  regionGrow,
  extractRegion
}
