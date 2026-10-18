import { hex as fmtHex } from '../../../platform';
import { escapeHtml } from '../../../core/webview/html';

/**
 * games/evermore/emulator/trace-formatter.ts
 *
 * Unified trace entry formatting class ensuring identical visual presentation,
 * tags, token categories, and colors across both the VS Code OutputChannel
 * and the Emulator webview SCRIPT TRACE log.
 *
 * Strictly ASCII-only.
 */

/** One SCRIPT TRACE entry from the page (webview/trace.js). */
interface TraceItem {
  timeStr?: string; entity?: number; event?: string; slot?: number; locHex?: string; loc?: number;
  summary?: string; bytesHex?: string;
}
/** A follow-up line under an entry: an address the instruction reached (a call, a read). */
interface TraceSub { addrHex: string; summary?: string; bytesHex?: string; callKind?: string }
/** What address-lookup.js knows about the script an entry belongs to. */
interface TraceLookup { shortTag?: string; name?: string }

function escH(s: unknown): string {
  return escapeHtml(String(s || ''));
}

const SCRIPT_TOKEN = /("[^"]*")|(\([^()]*\))|(\$[0-9a-fA-F]+|0x[0-9a-fA-F]+|\b0d\d+\b|\b\d+\b)|(\b(?:WRITE|CALL|RCALL|END|IF|THEN|SKIP|ELSE|GOTO|RETURN|WAIT|SLEEP|YIELD|SPAWN|NPC|CHANGE MAP|CHANGE MUSIC|UNHIDE\?|UNWINDOWED TEXT|SET|UNSET|CLEAR|COPY|READ|CHECK|TRIGGER|GET WEAPON|GAIN WEAPON|FADE IN|FADE OUT)\b|\b_[a-z_]+(?=\())/g;

function scriptHighlight(text: unknown): string {
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
  formatLookupTag(lookup: TraceLookup | null | undefined): string {
    if (!lookup || !lookup.shortTag) return '';
    return `[${lookup.shortTag}]`;
  }

  /**
   * Formats a main trace item as a plain-text line matching the everscript-trace
   * TextMate grammar used by the VS Code OutputChannel, with column-aligned addresses.
   */
  formatText(item: TraceItem, lookup?: TraceLookup | null): string {
    const timePart = item.timeStr ? `[${item.timeStr}]`.padEnd(16, ' ') : '';
    const entityHex = fmtHex(item.entity || 0, 4);
    const eventName = String(item.event || 'exec');
    const slotTag = `[s${item.slot} | ${entityHex} | ${eventName}]`;
    const slotPart = slotTag.padEnd(21, ' ');
    const lookupTag = this.formatLookupTag(lookup);
    const tagPart = lookupTag ? lookupTag.padEnd(16, ' ') : ''.padEnd(16, ' ');
    const arrowPart = '   ';
    const locHex = item.locHex || ('0x' + fmtHex(item.loc || 0, 6));

    if (eventName === 'end') {
      const summary = item.summary || 'END of script';
      return `${timePart}${slotPart}${tagPart}${arrowPart}${locHex}: ${summary}`;
    }

    const bytesHex = item.bytesHex || '??';
    const summary = item.summary || 'UNKNOWN INSTR';

    return `${timePart}${slotPart}${tagPart}${arrowPart}${locHex}: ${summary} [${bytesHex}]`;
  }

  /**
   * Formats a sub-line indented so the address begins at the exact same
   * column as the main script line, with `-> ` pointing to the address.
   */
  formatSubText(sub: TraceSub, item: TraceItem | null = null): string {
    const timePart = item && item.timeStr ? `[${item.timeStr}]`.padEnd(16, ' ') : '';
    const entityHex = fmtHex(item ? (item.entity || 0) : 0, 4);
    const slotTag = item ? `[s${item.slot} | ${entityHex}]` : '';
    const slotPart = slotTag ? slotTag.padEnd(21, ' ') : ''.padEnd(21, ' ');
    const tagPart = ''.padEnd(16, ' ');
    const arrowPart = '-> ';
    const bytes = sub.bytesHex ? ` [${sub.bytesHex}]` : '';
    const summary = sub.summary || '';
    return `${timePart}${slotPart}${tagPart}${arrowPart}${sub.addrHex}: ${summary}${bytes}`;
  }

  /**
   * Formats a sub-line as an HTML snippet with fixed column widths.
   */
  formatSubHtml(sub: TraceSub, item: TraceItem | null = null): string {
    const event = item ? (item.event || '') : '';
    const callClass = sub.callKind ? ` call-${sub.callKind}` : '';
    const bytes = sub.bytesHex ? ` <span class="ss-trace-bytes">[${escH(sub.bytesHex)}]</span>` : '';
    const summaryHtml = scriptHighlight(sub.summary || '');
    const timeHtml = item && item.timeStr
      ? '<span class="ss-trace-time">' + escH('[' + item.timeStr + ']') + '</span>'
      : '<span class="ss-trace-time"></span>';
    const entityHex = fmtHex(item ? (item.entity || 0) : 0, 4);
    const slotHtml = item
      ? '<span class="ss-trace-tag">' + escH('[s' + item.slot + ' | ' + entityHex + ']') + '</span>'
      : '<span class="ss-trace-tag"></span>';
    return `<div class="ss-trace-sub ${event}${callClass}">` +
      timeHtml +
      slotHtml +
      `<span class="ss-trace-lookup"></span>` +
      `<span class="ss-trace-arrow">-&gt;&nbsp;</span>` +
      `<span class="ss-trace-addr">${escH(sub.addrHex)}:</span>` +
      `<span class="ss-trace-text">${summaryHtml}</span>` +
      bytes +
      `</div>`;
  }

  /**
   * Formats a trace item and any follow-up sub-items into complete HTML markup
   * with column-aligned addresses.
   */
  formatHtml(item: TraceItem, lookup?: TraceLookup | null, subItems: TraceSub[] = []): string {
    const event = item.event || '';
    const tagClass = 'ss-trace-tag ' + event;
    const timeHtml = item.timeStr
      ? '<span class="ss-trace-time">' + escH('[' + item.timeStr + ']') + '</span>'
      : '<span class="ss-trace-time"></span>';
    const lookupTitle = lookup && lookup.name ? escH(lookup.name) : '';
    const lookupHtml = lookup && lookup.shortTag
      ? '<span class="ss-trace-lookup" title="' + lookupTitle + '">' + escH('[' + lookup.shortTag + ']') + '</span>'
      : '<span class="ss-trace-lookup"></span>';
    const entityHex = fmtHex(item.entity || 0, 4);
    const locHex = item.locHex || ('0x' + fmtHex(item.loc || 0, 6));
    const summary = item.summary || (event === 'end' ? 'END of script' : 'UNKNOWN INSTR');
    const summaryHtml = scriptHighlight(summary);

    const bytesSpan = (event === 'end' || !item.bytesHex)
      ? ''
      : ' <span class="ss-trace-bytes">[' + escH(item.bytesHex) + ']</span>';

    let html = '<div class="ss-trace-row ' + event + '">' +
      timeHtml +
      '<span class="' + tagClass + '">' + escH('[s' + item.slot + ' | ' + entityHex + ' | ' + event + ']') + '</span>' +
      lookupHtml +
      '<span class="ss-trace-arrow"></span>' +
      '<span class="ss-trace-addr">' + escH(locHex) + ':</span>' +
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

export type { TraceItem, TraceSub, TraceLookup };
export { ScriptTraceFormatter, scriptHighlight, escH, fmtHex };
