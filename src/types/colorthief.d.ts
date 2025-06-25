declare module 'colorthief' {
  type Color = [number, number, number];
  class ColorThief {
    static getColor(
      img: Buffer | string,
      quality?: number
    ): Promise<Color>;
    static getPalette(
      img: Buffer | string,
      colorCount?: number,
      quality?: number
    ): Promise<Color[]>;
  }
  export default ColorThief;
} 