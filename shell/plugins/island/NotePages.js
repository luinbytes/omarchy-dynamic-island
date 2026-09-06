var DEFAULT_MAX_CHARACTERS = 420
var DEFAULT_MAX_LINES = 8

function boundedInteger(value, fallback) {
  return typeof value === "number" && isFinite(value) && Math.floor(value) === value && value > 0 ? value : fallback
}

function safeEnd(text, start, candidate) {
  var end = Math.max(start + 1, Math.min(text.length, candidate))
  if (end < text.length) {
    var left = text.charCodeAt(end - 1)
    var right = text.charCodeAt(end)
    if (left >= 0xd800 && left <= 0xdbff && right >= 0xdc00 && right <= 0xdfff) {
      end = end - 1 > start ? end - 1 : Math.min(text.length, end + 1)
    }
  }
  return end
}

function pages(rawText, rawMaxCharacters, rawMaxLines) {
  var text = typeof rawText === "string" ? rawText : ""
  var maxCharacters = boundedInteger(rawMaxCharacters, DEFAULT_MAX_CHARACTERS)
  var maxLines = boundedInteger(rawMaxLines, DEFAULT_MAX_LINES)
  if (text.length === 0) return [{ index: 0, start: 0, end: 0, text: "" }]
  var result = []
  var start = 0
  while (start < text.length) {
    var end = safeEnd(text, start, start + maxCharacters)
    var newlineCount = 0
    for (var index = start; index < end; index++) {
      if (text.charAt(index) !== "\n") continue
      newlineCount += 1
      if (newlineCount >= maxLines) {
        end = index > start ? index : index + 1
        break
      }
    }
    result.push({ index: result.length, start: start, end: end, text: text.slice(start, end) })
    start = end
  }
  return result
}

function page(rawText, rawIndex, maxCharacters, maxLines) {
  var all = pages(rawText, maxCharacters, maxLines)
  var index = typeof rawIndex === "number" && isFinite(rawIndex) ? Math.floor(rawIndex) : 0
  index = Math.max(0, Math.min(all.length - 1, index))
  return Object.assign({}, all[index], { count: all.length })
}

function pageIndexForOffset(rawText, rawOffset, maxCharacters, maxLines) {
  var text = typeof rawText === "string" ? rawText : ""
  var offset = typeof rawOffset === "number" && isFinite(rawOffset) ? Math.floor(rawOffset) : 0
  offset = Math.max(0, Math.min(text.length, offset))
  var all = pages(text, maxCharacters, maxLines)
  for (var index = 0; index < all.length; index++) {
    if (offset < all[index].end || index === all.length - 1) return index
  }
  return all.length - 1
}

function splicePage(rawText, pageValue, replacement) {
  var text = typeof rawText === "string" ? rawText : ""
  if (!pageValue || typeof pageValue.start !== "number" || typeof pageValue.end !== "number"
      || pageValue.start < 0 || pageValue.end < pageValue.start || pageValue.end > text.length
      || typeof replacement !== "string") return null
  return text.slice(0, pageValue.start) + replacement + text.slice(pageValue.end)
}

if (typeof module !== "undefined") module.exports = {
  DEFAULT_MAX_CHARACTERS: DEFAULT_MAX_CHARACTERS,
  DEFAULT_MAX_LINES: DEFAULT_MAX_LINES,
  pages: pages,
  page: page,
  pageIndexForOffset: pageIndexForOffset,
  splicePage: splicePage
}
