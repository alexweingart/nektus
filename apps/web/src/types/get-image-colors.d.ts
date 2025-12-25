declare module 'get-image-colors' {
  import { Color } from 'chroma-js';

  interface Options {
    /** Number of colours to return */
    count?: number;
    /** MIME type, e.g. 'image/png'. Optional when passing a Buffer */
    type?: string;
  }

  /**
   * Extracts an array of chroma.js `Color` objects from an image source. The source can be a
   * file path, URL, or raw `Buffer` containing image bytes.
   */
  function getColors(source: Buffer | string, options?: Options): Promise<Color[]>;

  export default getColors;
} 