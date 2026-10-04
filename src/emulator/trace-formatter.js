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

const SCRIPT_TOKEN = /("[^"]*")|(\([^()]*\))|(\$[0-9a-fA-F]+|0x[0-9a-fA-F]+|\b0d\d+\b|\b\d+\b)|(^[A-Z][A-Z_?]+(?: [A-Z][A-Z_?]+)?\b|\b_[a-z_]+(?=\())/g;

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
    if (!lookup) return '';
    return lookup.shortTag ? `[${lookup.shortTag}]` : '';
  }

  /**
   * Formats a trace item as a plain-text line matching the everscript-trace
   * TextMate grammar used by the VS Code OutputChannel.
   */
  formatText(item, lookup) {
    const timePrefix = item.timeStr ? `[${item.timeStr}] ` : '';
    const entityHex = fmtHex(item.entity || 0, 4);
    const eventName = String(item.event || 'exec');
    const slotTag = `[Slot ${item.slot} | Ent ${entityHex} | ${eventName}]`;
    const lookupTag = this.formatLookupTag(lookup);
    const lookupPrefix = lookupTag ? `${lookupTag} ` : '';
    const locHex = item.locHex || ('0x' + fmtHex(item.loc || 0, 6));
    const bytesHex = item.bytesHex || '??';
    const summary = item.summary || (eventName === 'end' ? 'END of script' : 'UNKNOWN INSTR');

    return `${timePrefix}${slotTag} ${lookupPrefix}${locHex}: ${bytesHex}  ${summary}`;
  }

  /**
   * Formats a trace item as an HTML row snippet for the webview UI.
   */
  formatHtml(item, lookup) {
    const event = item.event || '';
    const tagClass = 'ss-trace-tag ' + event;
    const timeHtml = item.timeStr ? '<span class="ss-trace-time">' + escH(item.timeStr) + '</span> ' : '';
    const lookupTitle = lookup && lookup.name ? escH(lookup.name) : '';
    const lookupHtml = lookup && lookup.shortTag
      ? '<span class="ss-trace-lookup" title="' + lookupTitle + '">' + escH('[' + lookup.shortTag + ']') + '</span> '
      : '';
    const entityHex = fmtHex(item.entity || 0, 4);
    const locHex = item.locHex || ('0x' + fmtHex(item.loc || 0, 6));
    const bytesHex = item.bytesHex || '??';
    const summaryHtml = scriptHighlight(item.summary || (event === 'end' ? 'END of script' : 'UNKNOWN INSTR'));

    let html = '<div class="ss-trace-row ' + event + '">' +
      timeHtml +
      '<span class="' + tagClass + '">' + escH('[s' + item.slot + ' | ' + entityHex + ' | ' + event + ']') + '</span> ' +
      lookupHtml +
      '<span class="ss-trace-addr">' + escH(locHex) + '</span> ' +
      '<span class="ss-trace-bytes">[' + escH(bytesHex) + ']</span> ' +
      '<span class="ss-trace-text">' + summaryHtml + '</span>' +
      '</div>';

    if (item.subLines && item.subLines.length) {
      for (const sub of item.subLines) {
        html += '<div class="ss-trace-sub">' + escH(sub) + '</div>';
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
