// Change these static asset references to try a different stamp design.
// Keep require() paths literal so Metro can include the images in the app bundle.
export const STAMP_ASSETS = Object.freeze({
  done: require('../../assets/card/done_stamp_gray.png'),
  doneRings: require('../../assets/card/done_stamp_rings_gray.png'),
  void: Object.freeze({
    default: require('../../assets/card/void_stamp_red.png'),
    doneCard: require('../../assets/card/void_stamp_blue.png'),
  }),
});
