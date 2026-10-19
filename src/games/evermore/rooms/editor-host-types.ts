// Ownership: the shapes the map editor's host handlers share (editor-host.ts dispatches to editor-host-rom.ts and
// editor-host-suggest.ts): the page's message, and what the radar hands each handler as `ctx`.

import type * as vscode from 'vscode';
import type { createManaRooms } from '../imports/mana/rooms';

/** A message from the Rooms page: the command and its fields (the wire format is the page's, see rooms/webview/). */
interface EditorMessage { command: string; [key: string]: any }

/** The ROM that answers a request about room `roomId`: the room's own, a converted room's image, or the reason it cannot. */
type RoomRomAnswer = { romBuf: Uint8Array; roomId: number } | { error: string };

/** What the radar (games/evermore/radar-open.js) owns and lends a handler. */
interface EditorContext {
    /** To the radar webview. */
    post(message: object): void;
    /** A ROM room, or a converted room's image, or `{ error }`. */
    roomRom(roomId: number): RoomRomAnswer;
    /** The Mana-room bridge (imports/mana), or null. */
    manaRooms: ReturnType<typeof createManaRooms> | null;
    /** The "map export" output channel. */
    exportChannel(): vscode.OutputChannel;
    /** The emulator panel with a built ROM. */
    openEmulator(rom: { dataUrl: string; name: string; romBuffer?: Uint8Array; draft?: unknown; filePath?: string; kind?: string }): void;
    /** The extension context (global storage). */
    context: vscode.ExtensionContext;
}

type EditorHandler = (msg: EditorMessage, ctx: EditorContext) => void;

/** The text of a caught value, for a message shown to the user. */
const errorText = (err: unknown): string => err instanceof Error ? err.message : String(err);

export type { EditorMessage, EditorContext, EditorHandler, RoomRomAnswer };
export { errorText };
