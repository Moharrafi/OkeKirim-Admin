export const REQUIRED_TRANSFER_RECIPIENT = "GITA VEBBY ILLAHY"

export function normalizeRecipientText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/1/g, "I")
    .replace(/0/g, "O")
    .replace(/5/g, "S")
    .replace(/8/g, "B")
    // Substring spelling corrections for OCR errors matching "GITA VEBBY ILLAHY"
    .replace(/\bITA\b/g, "GITA")
    .replace(/G1TA/g, "GITA")
    .replace(/GLTA/g, "GITA")
    .replace(/CITA/g, "GITA")
    .replace(/CITE/g, "GITA")
    .replace(/CLTE/g, "GITA")
    .replace(/CLTA/g, "GITA")
    .replace(/GTTA/g, "GITA")
    .replace(/VEBY/g, "VEBBY")
    .replace(/VE8BY/g, "VEBBY")
    .replace(/VEB8Y/g, "VEBBY")
    .replace(/WEBY/g, "VEBBY")
    .replace(/WEBBY/g, "VEBBY")
    .replace(/ILLAHI/g, "ILLAHY")
    .replace(/ILAHI/g, "ILLAHY")
    .replace(/ILAHY/g, "ILLAHY")
    .replace(/LLAHY/g, "ILLAHY")
    .replace(/ILIAHY/g, "ILLAHY")
    .replace(/ILIAHI/g, "ILLAHY")
    .replace(/ILYAHY/g, "ILLAHY")
    .replace(/ILYAHI/g, "ILLAHY")
    .replace(/LIAHY/g, "ILLAHY")
    .replace(/I+LLAHY/g, "ILLAHY")
    .replace(/[^A-Z]/g, "")
}

export function recipientSimilarity(candidate: string) {
  const target = normalizeRecipientText(REQUIRED_TRANSFER_RECIPIENT)
  
  // Clean prefix like "Ke", "Kepada", "Penerima" and special characters (like avatar ©)
  const cleanCandidate = candidate
    .replace(/^(KE\s*REKENING|TRANSFER\s*KE|NAMA\s*PENERIMA|PENERIMA|KEPADA|KE)\b[:\s©]*/i, "")
    .trim()

  const normalizedCandidate = normalizeRecipientText(cleanCandidate)
  if (!normalizedCandidate) return 0
  if (normalizedCandidate.includes(target)) return 1

  const rows = target.length + 1
  const cols = normalizedCandidate.length + 1
  const distances = Array.from({ length: rows }, (_, row) => Array(cols).fill(row))
  for (let col = 0; col < cols; col++) distances[0][col] = col

  for (let row = 1; row < rows; row++) {
    for (let col = 1; col < cols; col++) {
      const cost = target[row - 1] === normalizedCandidate[col - 1] ? 0 : 1
      distances[row][col] = Math.min(
        distances[row - 1][col] + 1,
        distances[row][col - 1] + 1,
        distances[row - 1][col - 1] + cost
      )
    }
  }

  const distance = distances[target.length][normalizedCandidate.length]
  const charSimilarity = 1 - distance / Math.max(target.length, normalizedCandidate.length)

  // Word-based fuzzy similarity check
  const targetWords = REQUIRED_TRANSFER_RECIPIENT.split(" ")
  const candidateWords = cleanCandidate
    .split(/\s+/)
    .map((w) => normalizeRecipientText(w))
    .filter((w) => w.length >= 2)

  if (candidateWords.length === 0) return charSimilarity

  let wordScoreSum = 0
  for (const targetWord of targetWords) {
    let bestWordScore = 0
    for (const candidateWord of candidateWords) {
      const wRows = targetWord.length + 1
      const wCols = candidateWord.length + 1
      const wDistances = Array.from({ length: wRows }, (_, r) => Array(wCols).fill(r))
      for (let c = 0; c < wCols; c++) wDistances[0][c] = c

      for (let r = 1; r < wRows; r++) {
        for (let c = 1; c < wCols; c++) {
          const cost = targetWord[r - 1] === candidateWord[c - 1] ? 0 : 1
          wDistances[r][c] = Math.min(
            wDistances[r - 1][c] + 1,
            wDistances[r][c - 1] + 1,
            wDistances[r - 1][c - 1] + cost
          )
        }
      }
      const wDist = wDistances[targetWord.length][candidateWord.length]
      const wScore = 1 - wDist / Math.max(targetWord.length, candidateWord.length)
      if (wScore > bestWordScore) {
        bestWordScore = wScore
      }
    }
    wordScoreSum += bestWordScore
  }
  const wordSimilarity = wordScoreSum / targetWords.length

  return Math.max(charSimilarity, wordSimilarity)
}

export function extractTransferRecipient(text: string) {
  const requiredWords = REQUIRED_TRANSFER_RECIPIENT.split(" ")
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)

  const directLine = lines.find((line) => {
    const normalizedLine = line
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
    return requiredWords.every((word) => normalizedLine.includes(word))
  })

  if (directLine) {
    return { matched: true, detectedName: directLine }
  }

  const destinationRecipientLine = lines.find((line, index) => {
    const previousLineLooksLikeDestination = /^ke\s*\d+/i.test(lines[index - 1] || "")
    const letterCount = (line.match(/[A-Za-z]/g) || []).length
    const nonRecipientPattern = /^(BCA|BRI|BNI|MANDIRI|CIMB|DANA|OVO|GOPAY|SHOPEEPAY|RP|IDR|ADMIN|BIAYA|TOTAL)/i
    return previousLineLooksLikeDestination && letterCount >= 3 && !nonRecipientPattern.test(line)
  })

  if (destinationRecipientLine) {
    const score = recipientSimilarity(destinationRecipientLine)
    return { matched: score >= 0.82, detectedName: destinationRecipientLine }
  }

  const ignoredLinePattern = /^(M[\s-]?TRANSFER|TRANSFER|BERHASIL|GAGAL|PENDING|BCA|RP|IDR|ADMIN|BIAYA|TOTAL|NO\.?|REF|TANGGAL|DARI|KE\s*\d+)/i
  const candidateLines = lines.filter((line, index) => {
    const letterCount = (line.match(/[A-Za-z]/g) || []).length
    const previousLineLooksLikeDestination = /^ke\s*\d+/i.test(lines[index - 1] || "")
    return letterCount >= 6 && (previousLineLooksLikeDestination || !ignoredLinePattern.test(line))
  })

  let bestCandidate: { line: string; score: number } | null = null
  for (const line of candidateLines) {
    const score = recipientSimilarity(line)
    if (!bestCandidate || score > bestCandidate.score) {
      bestCandidate = { line, score }
    }
  }

  if (bestCandidate && bestCandidate.score >= 0.82) {
    return { matched: true, detectedName: bestCandidate.line }
  }

  return {
    matched: false,
    detectedName: bestCandidate?.score && bestCandidate.score >= 0.45 ? bestCandidate.line : null,
  }
}
