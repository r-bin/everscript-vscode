'use strict';

/**
 * debugger/emulator/trace-formatter.js
 *
 * Unified trace entry formatting class ensuring identical visual presentation,
 * tags, token categories, and colors across both the VS Code OutputChannel
 * and the Emulator webview SCRIPT TRACE log.
 *
 * Strictly ASCII-only.
 */

function escH(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtHex(val, width) {
  return (val >>> 0).toString(16).toUpperCase().padStart(width, '0');
}

const SCRIPT_TOKEN = /("[^"]*")|(\([^()]*\))|(\$[0-9a-fA-F]+|0x[0-9a-fA-F]+|\b0d\d+\b|\b\d+\b)|(\b(?:WRITE|CALL|RCALL|END|IF|THEN|SKIP|ELSE|GOTO|RETURN|WAIT|SLEEP|YIELD|SPAWN|NPC|CHANGE MAP|CHANGE MUSIC|UNHIDE\?|UNWINDOWED TEXT|SET|UNSET|CLEAR|COPY|READ|CHECK|TRIGGER|GET WEAPON|GAIN WEAPON|FADE IN|FADE OUT)\b|\b_[a-z_]+(?=\())/g;

function scriptHighlight(text) {
  let out = '';
  let last = 0;
  let m;
  const src = String(text || '');
  const re = new RegExp(SCRIPT_TOKEN.source, 'g');
  while ((m = re.exec(src))) {
    out += escH(src.slice(last, m.index));
    if (m[2]) {
      const aside = !src.slice(m.index + m[0].length).trim();
      const inner = '(' + scriptHighlight(m[2].slice(1, -1)) + ')';
      out += aside ? '<span class="sx-aside">' + inner + '</span>' : inner;
    } else {
      out += '<span class="' + (m[1] ? 'sx-str' : m[3] ? 'sx-num' : 'sx-kw') + '">' + escH(m[0]) + '</span>';
    }
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  return out + escH(src.slice(last));
}

class ScriptTraceFormatter {
  constructor(options = {}) {
    this.hideInactive = !!options.hideInactive;
  }

  isInactiveStatus(event) {
    return event === 'end';
  }

  formatLookupTag(lookup) {
    if (!lookup || !lookup.shortTag) return '';
    return `[${lookup.shortTag}]`;
  }

  /**
   * Formats a main trace item as a plain-text line matching the everscript-trace
   * TextMate grammar used by the VS Code OutputChannel.
   * Opcode hex bytes are placed at the end: [00 01 02 ...]
   */
  formatText(item, lookup) {
    const timePrefix = item.timeStr ? `[${item.timeStr}] ` : '';
    const entityHex = fmtHex(item.entity || 0, 4);
    const eventName = String(item.event || 'exec');
    const slotTag = `[s${item.slot} | ${entityHex} | ${eventName}]`;
    const lookupTag = this.formatLookupTag(lookup);
    const lookupPrefix = lookupTag ? `${lookupTag} ` : '';
    const locHex = item.locHex || ('0x' + fmtHex(item.loc || 0, 6));

    if (eventName === 'end') {
      const summary = item.summary || 'END of script';
      return `${timePrefix}${slotTag} ${lookupPrefix}${locHex}: ${summary}`;
    }

    const bytesHex = item.bytesHex || '??';
    const summary = item.summary || 'UNKNOWN INSTR';

    return `${timePrefix}${slotTag} ${lookupPrefix}${locHex}: ${summary} [${bytesHex}]`;
  }

  /**
   * Formats a sub-line (e.g. CALL or branch target) indented with 2 spaces
   * with a slot and optional timestamp prefix so slot attribution is clear.
   */
  formatSubText(sub, item = null) {
    const timePrefix = item && item.timeStr ? `[${item.timeStr}] ` : '';
    const entityHex = fmtHex(item ? (item.entity || 0) : 0, 4);
    const slotTag = item ? `[s${item.slot} | ${entityHex}]` : '';
    const prefix = slotTag ? `${timePrefix}${slotTag} ` : '';
    const bytes = sub.bytesHex ? ` [${sub.bytesHex}]` : '';
    const summary = sub.summary || '';
    return `${prefix}  -> ${sub.addrHex}: ${summary}${bytes}`;
  }

  /**
   * Formats a sub-line as an HTML snippet with full syntax highlighting.
   */
  formatSubHtml(sub, item = null) {
    const event = item ? (item.event || '') : '';
    const callClass = sub.callKind ? ` call-${sub.callKind}` : '';
    const bytes = sub.bytesHex ? ` <span class="ss-trace-bytes">[${escH(sub.bytesHex)}]</span>` : '';
    const summaryHtml = scriptHighlight(sub.summary || '');
    const timeHtml = item && item.timeStr ? '<span class="ss-trace-time">' + escH(item.timeStr) + '</span> ' : '';
    const entityHex = fmtHex(item ? (item.entity || 0) : 0, 4);
    const slotHtml = item ? '<span class="ss-trace-tag">' + escH('[s' + item.slot + ' | ' + entityHex + ']') + '</span> ' : '';
    return `<div class="ss-trace-sub ${event}${callClass}">` +
      timeHtml +
      slotHtml +
      `<span class="ss-trace-arrow">  -&gt; </span>` +
      `<span class="ss-trace-addr">${escH(sub.addrHex)}:</span> ` +
      `<span class="ss-trace-text">${summaryHtml}</span>` +
      bytes +
      `</div>`;
  }

  /**
   * Formats a trace item and any follow-up sub-items into complete HTML markup.
   */
  formatHtml(item, lookup, subItems = []) {
    const event = item.event || '';
    const tagClass = 'ss-trace-tag ' + event;
    const timeHtml = item.timeStr ? '<span class="ss-trace-time">' + escH(item.timeStr) + '</span> ' : '';
    const lookupTitle = lookup && lookup.name ? escH(lookup.name) : '';
    const lookupHtml = lookup && lookup.shortTag
      ? '<span class="ss-trace-lookup" title="' + lookupTitle + '">' + escH('[' + lookup.shortTag + ']') + '</span> '
      : '';
    const entityHex = fmtHex(item.entity || 0, 4);
    const locHex = item.locHex || ('0x' + fmtHex(item.loc || 0, 6));
    const summary = item.summary || (event === 'end' ? 'END of script' : 'UNKNOWN INSTR');
    const summaryHtml = scriptHighlight(summary);

    const bytesSpan = (event === 'end' || !item.bytesHex)
      ? ''
      : ' <span class="ss-trace-bytes">[' + escH(item.bytesHex) + ']</span>';

    let html = '<div class="ss-trace-row ' + event + '">' +
      timeHtml +
      '<span class="' + tagClass + '">' + escH('[s' + item.slot + ' | ' + entityHex + ' | ' + event + ']') + '</span> ' +
      lookupHtml +
      '<span class="ss-trace-addr">' + escH(locHex) + ':</span> ' +
      '<span class="ss-trace-text">' + summaryHtml + '</span>' +
      bytesSpan +
      '</div>';

    if (Array.isArray(subItems) && subItems.length) {
      for (const sub of subItems) {
        html += this.formatSubHtml(sub, item);
      }
    }
    return html;
  }
}

module.exports = {
  ScriptTraceFormatter,
  scriptHighlight,
  escH,
  fmtHex,
};
