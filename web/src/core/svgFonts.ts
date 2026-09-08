// Keep editable SVG text portable in viewers that support embedded webfonts.
// Only ship the already bundled OFL font subsets used by actual text runs.
const unquote = (s: string) => s.trim().replace(/^["']|["']$/g, '');
const superDigits = '⁰¹²³⁴⁵⁶⁷⁸⁹', subDigits = '₀₁₂₃₄₅₆₇₈₉';
const normalDigit = (c: string) => String(Math.max(superDigits.indexOf(c),subDigits.indexOf(c)));

/** Some CJK desktop faces lack Unicode script digits. Editable SVG tspans
 * preserve their scientific meaning without depending on fallback glyphs. */
export function portableScriptDigits(svg: SVGSVGElement) {
  const walker = document.createTreeWalker(svg, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = []; let node: Node | null;
  while ((node=walker.nextNode())) if(node.parentElement?.closest('text') && /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(node.textContent || '')) nodes.push(node as Text);
  for(const node of nodes) {
    const fragment=document.createDocumentFragment();
    for(const part of node.data.split(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+|[₀₁₂₃₄₅₆₇₈₉]+)/)) {
      if(!part) continue;
      const superScript=superDigits.includes(part[0]),subScript=subDigits.includes(part[0]);
      if(!superScript && !subScript) {fragment.append(document.createTextNode(part));continue;}
      const span=document.createElementNS('http://www.w3.org/2000/svg','tspan');
      span.setAttribute('font-size','70%');
      span.setAttribute('baseline-shift',superScript?'super':'sub');
      span.setAttribute('data-scientific-script',superScript?'super':'sub');
      span.textContent=[...part].map(normalDigit).join('');fragment.append(span);
    }
    node.replaceWith(fragment);
  }
}
function contains(range: string, character: string) {
  const code = character.codePointAt(0)!;
  return range.split(',').some(part => {
    const token = part.trim().replace(/^U\+/i, '');
    const [lo, hi = lo] = token.includes('?')
      ? [token.replaceAll('?', '0'), token.replaceAll('?', 'F')]
      : token.split('-');
    return code >= parseInt(lo, 16) && code <= parseInt(hi, 16);
  });
}
export async function embedSvgFonts(source: SVGSVGElement, clone: SVGSVGElement, signal: AbortSignal) {
  const runs = [...source.querySelectorAll('text,tspan,textPath')].map(el => {
    const s = getComputedStyle(el);
    const text=el.textContent || '';
    return { family:s.fontFamily.split(',').map(unquote), weight:Number(s.fontWeight)<=500?'400':'700', style:s.fontStyle, text:text+text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g,normalDigit) };
  });
  const faces: CSSFontFaceRule[] = [];
  function visit(rules: CSSRuleList) {
    for (const rule of [...rules]) {
      if (rule.type === CSSRule.FONT_FACE_RULE) faces.push(rule as CSSFontFaceRule);
      else if ('cssRules' in rule) visit((rule as CSSGroupingRule).cssRules);
      else if (rule.type === CSSRule.IMPORT_RULE && (rule as CSSImportRule).styleSheet) visit((rule as CSSImportRule).styleSheet!.cssRules);
    }
  }
  for (const sheet of [...document.styleSheets]) {
    try { visit(sheet.cssRules); } catch { /* Cross-origin page CSS is not a bundled font source. */ }
  }
  const selected = faces.filter(f => runs.some(r =>
    r.family.includes(unquote(f.style.getPropertyValue('font-family'))) &&
    r.weight === f.style.getPropertyValue('font-weight') &&
    r.style === f.style.getPropertyValue('font-style') &&
    [...r.text].some(c => contains(f.style.getPropertyValue('unicode-range') || 'U+0-10FFFF', c))));
  const rules = await Promise.all(selected.map(async face => {
    const src = face.style.getPropertyValue('src');
    const path = src.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!path) throw new Error('图表字体文件缺少可嵌入地址。');
    const url = new URL(path, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/fonts/woff2/'))
      throw new Error('图表字体不属于内置可嵌入字体，请使用文字转曲。');
    const response = await fetch(url, {signal});
    if (!response.ok) throw new Error('图表字体子集读取失败，请重试。');
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    return face.cssText.replace(/src:\s*[^;]+;/, `src:url("data:font/woff2;base64,${btoa(binary)}") format("woff2");`);
  }));
  if (signal.aborted) throw new DOMException('已取消导出。', 'AbortError');
  if (rules.length) {
    const licenseResponse = await fetch('/fonts/OFL.txt', {signal});
    if (!licenseResponse.ok) throw new Error('字体授权说明读取失败，请重试。');
    const license = document.createElementNS('http://www.w3.org/2000/svg', 'metadata');
    license.setAttribute('data-openacad-font-license', 'OFL-1.1');
    license.textContent = await licenseResponse.text();
    clone.prepend(license);
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.setAttribute('data-openacad-fonts', 'embedded');
    style.textContent = '/* Noto / Source Han fonts, SIL Open Font License 1.1. https://openfontlicense.org */\n' + [...new Set(rules)].join('\n');
    clone.prepend(style);
  }
}
