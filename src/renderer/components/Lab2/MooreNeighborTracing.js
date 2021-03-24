function mooreNeighborTrace (imgM, initX, initY) {
  let sP = null

  for (let i = 0; i < imgM.length; i++) {
    if (imgM[i][0].r === 255) {
      let a = imgM[i][0]; a.r = 0; a.g = 255; a.b = 0
      sP = [i, 0]
      break
    }
  }

  let fR = 0
  let cN = 0
  let cP = sP
  let nB = [ [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1] ]

  do {
    while (1) {
      if (((cP[0] + nB[cN][0]) > (imgM.length - 1)) || ((cP[0] + nB[cN][0]) < 0)) {
        if (fR === 0 && (cN + 1) === nB.length) return imgM
        else cN = (cN + 1) % nB.length
        continue
      }

      if (((cP[1] + nB[cN][1]) > (imgM[0].length - 1)) || ((cP[1] + nB[cN][1]) < 0)) {
        if (fR === 0 && (cN + 1) === nB.length) return imgM
        else cN = (cN + 1) % nB.length
        continue
      }

      if (imgM[cP[0] + nB[cN][0]][cP[1] + nB[cN][1]].r === 255 || imgM[cP[0] + nB[cN][0]][cP[1] + nB[cN][1]].g === 255) {
        let a = imgM[cP[0] + nB[cN][0]][cP[1] + nB[cN][1]]; a.r = 0; a.g = 255; a.b = 0
        let tmpPt = [cP[0] + nB[cN][0], cP[1] + nB[cN][1]]

        if (cN === 0) cN = nB.length - 1
        else cN = cN - 1

        for (let j = 0; j < nB.length; j++) {
          if (cP[0] + nB[cN][0] === tmpPt[0] + nB[j][0]) {
            if (cP[1] + nB[cN][1] === tmpPt[1] + nB[j][1]) {
              cP = tmpPt; fR = 1; cN = j; break
            }
          }
        }

        break
      }

      cN = (cN + 1) % nB.length
    }
  } while (!(cP[0] === sP[0] && cP[1] === sP[1]))

  return imgM
}

export default {
  mooreNeighborTrace
}
