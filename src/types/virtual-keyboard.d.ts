// TypeScript declarations for the VirtualKeyboard API
interface VirtualKeyboard {
  show(): void;
  hide(): void;
  readonly boundingRect: DOMRect | null;
}

// Extend the Navigator interface to include virtualKeyboard property
interface Navigator {
  readonly virtualKeyboard?: VirtualKeyboard;
}
