// Change these static asset references to try a different stamp design.
// Keep require() paths literal so Metro can include the images in the app bundle.
export const STAMP_ASSETS = Object.freeze({
  done: require('../../assets/collections/mobile/monster-gray-02fe9eabd8acbc2c.webp'),
  doneRings: require('../../assets/card/done_stamp_rings_gray.png'),
  void: Object.freeze({
    default: require('../../assets/collections/mobile/monster-red-f6195dfca3f39bbd.webp'),
    doneCard: require('../../assets/collections/mobile/monster-blue-f70c8ce7fea5d0ef.webp'),
  }),
});
