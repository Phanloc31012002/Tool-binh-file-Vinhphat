const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Mốc số lượng từ lấy theo v2.15.4. Các snapshot control/điều hướng đã gồm
// việc dời ghi chú theo yêu cầu (v2.15.17) và ô tên file CTL/script đóng gói (v2.16.1). Không phụ thuộc vào
// extension đã cài hay đường dẫn người dùng Windows khi chạy trong CI.
const baseline = {
  controlHash:
    "2b9df988d5c48a2a7ff6ac50dc795df1e11622515a444ee05f1718a677e2e338",
  navigationHash:
    "d4487d9056941ac67e4b8d77215a663f0be6ad08d8a8f23a4d47da4e7561c3cc",
  controlCount: 118,
  staticHintWords: 1293,
};

function compactOutsideQuotes(value) {
  let result = "",
    quote = "",
    space = false;
  for (const character of value) {
    if (quote) {
      result += character;
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      if (space && result) result += " ";
      space = false;
      result += character;
      quote = character;
    } else if (/\s/.test(character)) {
      space = true;
    } else {
      if (space && result) result += " ";
      space = false;
      result += character;
    }
  }
  return result.trim();
}

function attribute(tag, name) {
  const match = tag.match(
    new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)')", "i"),
  );
  return match ? (match[1] === undefined ? match[2] : match[1]) : null;
}

function plain(value) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:39|x27);/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function digest(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function snapshot(html) {
  const openingTags =
    html.match(/<[a-z][\w-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi) || [];
  const controls = openingTags
    .filter((tag) =>
      /^<(?:input|select|option|button|script|link)\b/i.test(tag),
    )
    .map((tag) =>
      compactOutsideQuotes(
        tag.replace(/\s+title\s*=\s*(?:"[^"]*"|'[^']*')/gi, ""),
      ),
    );
  const navigation = [];
  for (const tag of openingTags) {
    for (const name of ["data-tab", "data-acc"]) {
      const value = attribute(tag, name);
      if (value !== null) navigation.push([name, value]);
    }
    const classes = (attribute(tag, "class") || "").split(/\s+/);
    if (classes.includes("tabpane") || classes.includes("acc-body")) {
      navigation.push(["pane", attribute(tag, "id")]);
    }
  }
  const staticHints = [];
  for (const match of html.matchAll(
    /<(p|div)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,
  )) {
    if (!(attribute(match[0], "class") || "").split(/\s+/).includes("hint"))
      continue;
    const contentStart = match.index + match[0].length;
    const contentEnd = html.indexOf("</" + match[1] + ">", contentStart);
    assert(contentEnd >= contentStart, "Static hint must have a closing tag.");
    const text = plain(html.slice(contentStart, contentEnd));
    if (!text) continue; // Các chỗ giữ chỗ trạng thái động để trống là cố ý.
    staticHints.push({ text, words: text.split(/\s+/).length });
  }
  return {
    controlHash: digest(controls),
    navigationHash: digest(navigation),
    controlCount: controls.length,
    staticHintWords: staticHints.reduce((sum, hint) => sum + hint.words, 0),
    staticHints,
  };
}

function pane(html, id) {
  const start = html.indexOf('id="' + id + '"');
  assert(start >= 0, "Keep tab " + id + " accessible.");
  const end = html.indexOf("</main>", start);
  assert(end > start);
  return plain(html.slice(start, end));
}

function run() {
  const html = fs.readFileSync(
    path.join(__dirname, "../DanCardCEP/index.html"),
    "utf8",
  );
  const current = snapshot(html);
  assert.strictEqual(
    current.controlHash,
    baseline.controlHash,
    "Copy-only cleanup must not change control IDs, types, defaults, events, options, scripts, or styles.",
  );
  assert.strictEqual(
    current.navigationHash,
    baseline.navigationHash,
    "All tabs, accordions, and panel IDs must remain intact.",
  );
  assert.strictEqual(current.controlCount, baseline.controlCount);
  for (const hint of current.staticHints) {
    assert(
      hint.words <= 40,
      "Keep each static hint at most 40 words: " + hint.text,
    );
  }
  assert(
    current.staticHintWords <= baseline.staticHintWords / 2,
    "The all-tab cleanup must remove at least half of the static hint words.",
  );

  const kts = pane(html, "pane-toiuu");
  assert.match(kts, /trái[^.]{0,40}(?:trước|front)/i);
  assert.match(kts, /phải[^.]{0,40}(?:sau|back)/i);
  assert.match(kts, /Khuôn\s*→\s*Bài/i);
  assert.match(kts, /Khuôn\s*→\s*Trước\s*→\s*Sau/i);
  assert.match(
    pane(html, "pane-catalogue"),
    /(?:bội số(?: của)?|chia hết cho)\s*4/i,
  );
  assert.match(
    pane(html, "pane-offset"),
    /(?:bội số(?: của)?|chia hết cho)\s*4/i,
  );
  assert.match(
    kts,
    /(?:xóa|xoá)[^.]{0,90}(?:đã dàn|đã đặt|đã vào)/i,
    "Offset must continue warning that only successfully placed source pairs are deleted.",
  );
  assert.match(
    kts,
    /(?:chưa dàn|chưa đặt|chưa vào|chưa vừa|không vừa)[^.]{0,70}(?:giữ|nguyên)/i,
    "Offset must explain that unplaced sources remain intact.",
  );

  const autosave = pane(html, "pane-autosave");
  assert.match(autosave, /trái[^.]{0,40}trước/i);
  assert.match(autosave, /phải[^.]{0,40}sau/i);
  assert.match(
    autosave,
    /PDF[^.]{0,50}(?:1\s*[/–-]\s*2|1 hoặc 2|2 hoặc 1|1\s*trang[^.]{0,30}2\s*trang|2\s*trang[^.]{0,30}1\s*trang)/i,
  );
  assert.match(
    autosave,
    /(?:(?:file|nguồn|gốc)[^.]{0,40}(?:không[^.]{0,15}(?:sửa|đổi)|giữ nguyên)|không (?:sửa|đổi)[^.]{0,25}(?:file|nguồn|gốc))/i,
  );
  assert.match(autosave, /(?:thứ tự|tuần tự)/i);
  assert.match(
    autosave,
    /(?:mỗi con\s*×\s*mỗi số|nhân chéo|mỗi con[^.]{0,30}mọi số)/i,
  );
  console.log(
    "All-tab panel copy: controls/navigation unchanged, concise hints and essential workflow warnings passed.",
  );
}

module.exports = { snapshot };
if (require.main === module) run();
