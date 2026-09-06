const assert = require("node:assert/strict")
const NotePages = require("../../shell/plugins/island/NotePages.js")

assert.deepEqual(NotePages.pages(""), [{ index: 0, start: 0, end: 0, text: "" }])

const source = "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\n" + "x".repeat(900) + " 🌦 done"
const pages = NotePages.pages(source, 120, 3)
assert.equal(pages.map(page => page.text).join(""), source, "pages are contiguous and lossless")
assert.ok(pages.every(page => page.text.length <= 120), "each page has a bounded character count")
assert.ok(pages.every(page => (page.text.match(/\n/g) || []).length <= 2), "each page has at most three rendered logical lines")
assert.ok(pages.every(page => !(/[\uD800-\uDBFF]$/.test(page.text))), "a page never ends inside a surrogate pair")

const middle = pages[Math.floor(pages.length / 2)]
const replacement = "edited 🌤\nwithout loss"
const edited = NotePages.splicePage(source, middle, replacement)
assert.equal(edited, source.slice(0, middle.start) + replacement + source.slice(middle.end),
  "editing one page preserves every byte outside its contiguous slice")

const cursor = middle.start + replacement.length
const targetIndex = NotePages.pageIndexForOffset(edited, cursor, 120, 3)
const target = NotePages.page(edited, targetIndex, 120, 3)
assert.ok(cursor >= target.start && cursor <= target.end, "the global caret resolves into the repaged draft")
assert.equal(NotePages.page(source, -10, 120, 3).index, 0, "negative pages clamp to the first page")
assert.equal(NotePages.page(source, 9999, 120, 3).index, pages.length - 1, "large pages clamp to the last page")
assert.equal(NotePages.splicePage(source, { start: -1, end: 2 }, "bad"), null, "invalid slices fail closed")

const unicode = "😀界e\u0301🌦"
const unicodePages = NotePages.pages(unicode, 1, 2)
assert.equal(unicodePages.map(page => page.text).join(""), unicode, "wide Unicode and combining input remains lossless")
assert.ok(unicodePages.every(page => !(/[\uD800-\uDBFF]$/.test(page.text))), "a one-character budget still keeps surrogate pairs intact")

console.log("note paging is bounded, contiguous and lossless")
