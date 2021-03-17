function vectorTo2DMatrix (imageData) {
  const { width, height } = imageData

  const array = new Array(width)
    .fill(0)
    .map((arr, x) =>
      new Array(height)
        .fill(0)
        .map((arr2, y) => {
          const pixelCoordinates = Math.trunc(width * y + x) * 4
          return {
            r: imageData.data[pixelCoordinates],
            g: imageData.data[pixelCoordinates + 1],
            b: imageData.data[pixelCoordinates + 2],
            a: imageData.data[pixelCoordinates + 3]
          }
        })
    )

  return array
}

function matrix2DToVector (matrix) {
  const width = matrix.length
  const height = matrix[0].length
  const imageData = new ImageData(width, height)
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      const pixelCoordinates = Math.trunc(width * j + i) * 4
      imageData.data[pixelCoordinates] = matrix[i][j].r
      imageData.data[pixelCoordinates + 1] = matrix[i][j].g
      imageData.data[pixelCoordinates + 2] = matrix[i][j].b
      imageData.data[pixelCoordinates + 3] = matrix[i][j].a
    }
  }

  return imageData
}

export default {
  vectorTo2DMatrix,
  matrix2DToVector
}
