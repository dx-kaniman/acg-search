(async () => {
  // ====== helpers ======
  const toAbs = (url) => new URL(url, location.href).href;

  // <br> → 改行、残りタグ除去、改行整理
  const htmlToPlain = (html) => String(html||"")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const splitReadingAndName = (head) => {
    const m = String(head).match(/^([\u3040-\u30FFー・＝]+)(.+)$/u);
    return m ? { reading: m[1].trim(), name: m[2].trim() } : { reading: null, name: String(head).trim() };
  };

  // 領土：1文字＋スラッシュ保持（平/山/水/森/夜/無 と ／ を許可）
const territoryCharsFromCond = (raw) => {
  if (!raw) return "";
  // 半角スラッシュを全角に
  let s = String(raw).replace(/\//g, "／");
  // 許可文字以外を除去
  s = s.replace(/[^平山水森夜無／]/g, "");
  // 連続スラッシュの冗長を軽減（必要なければ削除してOK）
  s = s.replace(/／{2,}/g, "／").replace(/^／|／$/g, "");
  return s; // 例: "森／夜", "水水", "平／山／森"
};

  // カードコード（ACG-001 / BP1-001 / BP2-001 / RYO-001 / SET10-0123 等）
  // テキスト優先→画像URLでフォールバック
  const pickCode = (text, imgSrc) => {
    const pat = /（\s*([A-Z]+[0-9]*-[0-9]{3,})\s*）/;
    const m = String(text || "").match(pat);
    if (m) return m[1];
    const m2 = String(imgSrc || "").match(/([A-Z]+[0-9]*-[0-9]{3,})/);
    return m2 ? m2[1] : null;
  };

  const pickBracket = (label, text) => {
    const re = new RegExp("［\\s*" + label + "\\s*：\\s*([^］]+)］");
    const m = String(text).match(re);
    return m ? m[1].trim() : null;
  };

  const pickStats = (text) => {
    const m = String(text).match(/［\s*ATK\s*(\d+)\s*／\s*DEF\s*(\d+)\s*］/);
    return m ? { atk: +m[1], def: +m[2] } : { atk: null, def: null };
  };

  // 効果：**属性ブロックの直後の <br><br> を境界**として、それ以降の HTML を採用
  const extractEffectByDoubleBr = (el) => {
    const html = el.innerHTML;
    const dbl = /(?:<br\s*\/?>\s*){2,}/i;
    const idx = html.search(dbl);
    if (idx === -1) return "";            // 想定外：安全に空
    const effectHTML = html.slice(idx).replace(dbl, ""); // 先頭の <br><br> を除去
    return htmlToPlain(effectHTML);
  };

  const parseCardBlock = (el, productLabel) => {
    const img = el.querySelector("img");
    const imageUrl = img ? toAbs(img.getAttribute("src")) : null;

    const rawText = el.textContent.replace(/\s+/g, " ").trim();

    const code = pickCode(rawText, imageUrl);

    // ヘッダ（読み＋正式名）：コード前/最初の［前
    let head = rawText;
    if (code) {
      const marker = "（" + code + "）";
      const i = rawText.indexOf(marker);
      if (i >= 0) head = rawText.slice(0, i);
    } else {
      const i = rawText.indexOf("［");
      head = i >= 0 ? rawText.slice(0, i) : rawText;
    }
    const { reading, name } = splitReadingAndName(head);

    const costStr = pickBracket("コスト", rawText);
    const condStr = pickBracket("条件", rawText);
    const typeStr = pickBracket("タイプ", rawText);
    const raceStr = pickBracket("種属", rawText);
    const { atk, def } = pickStats(rawText);
    const effect = extractEffectByDoubleBr(el);

    const cost = costStr && /^\d+$/.test(costStr) ? parseInt(costStr, 10) : null;
    const territory = territoryCharsFromCond(condStr);

    return {
      id: code || null,
      product: productLabel || null,
      name: name || null,
      reading: reading || null,
      cost,
      territory,        // 例: "水水山無"
      type: typeStr || "",
      race: (raceStr || "") || null,
      atk, def,
      effect,
      imageUrl
    };
  };

  // ===== 実行 =====
  const product = prompt("このページの商品名（例：第1弾 / 第2弾 / 種属戦争 / 運命の物語 / 領土）：") || "";
  const nodes = Array.from(document.querySelectorAll(".cardlist_flex"));
  if (!nodes.length) { console.warn(".cardlist_flex が見つかりません"); return; }

  const data = nodes.map((el) => parseCardBlock(el, product));

  // ファイル名：cards_<slug>.json
  const slug = (product || "product").trim()
    .replace(/[\\s　]+/g, "_")
    .replace(/[\\u3000]/g, "_")
    .replace(/[^a-zA-Z0-9_\\-一-龠ぁ-んァ-ヶー]/g, "")
    .toLowerCase();
  const filename = `cards_${slug || "set"}.json`;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);

  console.log(`✅ 完了: ${data.length} 件 → ${filename}`, data);
})();
