'use client';

/**
 * Contact background overlay element + additional breathing glow layers
 * Replaces body::after which is now used for the breathing glow effect
 */
export function ContactBackgroundOverlay() {
  return (
    <>
      {/* Contact background overlay */}
      <div
        className="contact-background-overlay"
        style={{ pointerEvents: 'none' }}
      />

      {/* Additional breathing glow layers for wave effect */}
      <div className="breathing-glow-layer-2" style={{ pointerEvents: 'none' }} />
      <div className="breathing-glow-layer-3" style={{ pointerEvents: 'none' }} />
    </>
  );
}
