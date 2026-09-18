// Change these static asset references to try a different stamp design.
// Keep require() paths literal so Metro can include the images in the app bundle.
export const STAMP_ASSETS = Object.freeze({
  card: Object.freeze({
    collectionRings: require('../../assets/stamps/card/collection-rings-gray.png'),
    default: require('../../assets/stamps/card/gray-cat.webp'),
    void: require('../../assets/stamps/card/blue-cat.webp'),
  }),
  control: Object.freeze({
    blue: Object.freeze({
      cat: require('../../assets/stamps/control/blue-cat.webp'),
      circle: require('../../assets/stamps/control/blue-circle.webp'),
    }),
    gray: Object.freeze({
      cat: require('../../assets/stamps/control/gray-cat.webp'),
      circle: require('../../assets/stamps/control/gray-circle.webp'),
    }),
  }),
});

export const STAMP_RENDER_SCALE = 1.3;
