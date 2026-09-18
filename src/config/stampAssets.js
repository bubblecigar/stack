// Change these static asset references to try a different stamp design.
// Keep require() paths literal so Metro can include the images in the app bundle.
export const STAMP_ASSETS = Object.freeze({
  done: require('../../assets/collections/mobile/monster-gray-02fe9eabd8acbc2c.webp'),
  doneRings: require('../../assets/card/done_stamp_rings_gray.png'),
  void: Object.freeze({
    default: require('../../assets/collections/monster-blue-out-circle.webp'),
    doneCard: require('../../assets/collections/mobile/monster-blue-f70c8ce7fea5d0ef.webp'),
  }),
});

export const STAMP_RENDER_SCALE = 1.3;
