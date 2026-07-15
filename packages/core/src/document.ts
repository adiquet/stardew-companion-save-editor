/**
 * SaveDocument — owns the parsed DOM plus the byte-level details (BOM)
 * needed to write the file back exactly as the game would.
 */
import { parseXml, serializeXml, type XmlDocument, type XmlElement } from './xml.ts';
import { child, getPathText } from './dom.ts';

/** Save-format versions the accessors were built and verified against. */
export const VERIFIED_GAME_VERSIONS = ['1.6'];

export type SaveKind = 'full' | 'farmer';

export interface VersionInfo {
  gameVersion: string | null;
  /** true when the accessors in this library were verified against this version */
  verified: boolean;
}

export class SaveDocument {
  readonly doc: XmlDocument;
  readonly hadBom: boolean;
  /** 'full' = main <SaveGame> file, 'farmer' = SaveGameInfo (<Farmer> root) */
  readonly kind: SaveKind;

  private constructor(doc: XmlDocument, hadBom: boolean, kind: SaveKind) {
    this.doc = doc;
    this.hadBom = hadBom;
    this.kind = kind;
  }

  static fromBytes(bytes: Uint8Array): SaveDocument {
    const hadBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
    const text = new TextDecoder('utf-8').decode(hadBom ? bytes.subarray(3) : bytes);
    return SaveDocument.fromText(text, hadBom);
  }

  static fromText(text: string, hadBom = false): SaveDocument {
    const doc = parseXml(text);
    const rootTag = doc.documentElement.tagName;
    let kind: SaveKind;
    if (rootTag === 'SaveGame') kind = 'full';
    else if (rootTag === 'Farmer') kind = 'farmer';
    else {
      throw new Error(
        `Not a Stardew Valley save file: expected a <SaveGame> or <Farmer> root, found <${rootTag}>.`
      );
    }
    return new SaveDocument(doc, hadBom, kind);
  }

  get root(): XmlElement {
    return this.doc.documentElement;
  }

  /**
   * The <player>/<Farmer> element holding all player data, regardless of
   * which of the two save files this is.
   */
  get player(): XmlElement {
    if (this.kind === 'farmer') return this.root;
    const p = child(this.root, 'player');
    if (!p) throw new Error('Save file has no <player> element.');
    return p;
  }

  version(): VersionInfo {
    const gameVersion =
      this.kind === 'full'
        ? getPathText(this.root, 'gameVersion')
        : getPathText(this.root, 'gameVersion');
    const verified =
      gameVersion !== null && VERIFIED_GAME_VERSIONS.some((v) => gameVersion.startsWith(v));
    return { gameVersion, verified };
  }

  toText(): string {
    return serializeXml(this.doc);
  }

  toBytes(): Uint8Array {
    const body = new TextEncoder().encode(this.toText());
    if (!this.hadBom) return body;
    const out = new Uint8Array(body.length + 3);
    out[0] = 0xef;
    out[1] = 0xbb;
    out[2] = 0xbf;
    out.set(body, 3);
    return out;
  }
}
