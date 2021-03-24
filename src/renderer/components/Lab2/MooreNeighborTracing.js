function mooreNeighborTrace (srcImgM, destImgM) {
  let sP = null

  for (let i = 0; i < srcImgM.length; i++) {
    if (srcImgM[i][0].r === 255) {
      const a = { ...srcImgM[i][0] }; a.r = 0; a.g = 255; a.b = 0
      destImgM[i][0] = a
      sP = [i, 0]
      break
    }
  }

  let fR = 0
  let cN = 0
  let cP = sP
  const nB = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]

  do {
    while (1) {
      if (((cP[0] + nB[cN][0]) > (srcImgM.length - 1)) || ((cP[0] + nB[cN][0]) < 0)) {
        if (fR === 0 && (cN + 1) === nB.length) return
        else cN = (cN + 1) % nB.length
        continue
      }

      if (((cP[1] + nB[cN][1]) > (srcImgM[0].length - 1)) || ((cP[1] + nB[cN][1]) < 0)) {
        if (fR === 0 && (cN + 1) === nB.length) return
        else cN = (cN + 1) % nB.length
        continue
      }

      if (srcImgM[cP[0] + nB[cN][0]][cP[1] + nB[cN][1]].r === 255 || destImgM[cP[0] + nB[cN][0]][cP[1] + nB[cN][1]].g === 255) {
        const a = { ...srcImgM[cP[0] + nB[cN][0]][cP[1] + nB[cN][1]] }; a.r = 0; a.g = 255; a.b = 0
        destImgM[cP[0] + nB[cN][0]][cP[1] + nB[cN][1]] = a
        const tmpPt = [cP[0] + nB[cN][0], cP[1] + nB[cN][1]]

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
}

export default {
  mooreNeighborTrace
}
