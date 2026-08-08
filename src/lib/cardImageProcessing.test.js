import {
  CARD_IMAGE_MAX_EDGE,
  getCardImageResize,
} from './cardImageProcessing';

describe('card image processing', () => {
  it('scales a landscape image by width', () => {
    expect(getCardImageResize(4032, 3024)).toEqual({
      height: null,
      width: CARD_IMAGE_MAX_EDGE,
    });
  });

  it('scales a portrait image by height', () => {
    expect(getCardImageResize(3024, 4032)).toEqual({
      height: CARD_IMAGE_MAX_EDGE,
      width: null,
    });
  });

  it('does not enlarge a small image', () => {
    expect(getCardImageResize(1200, 900)).toBeNull();
  });

  it('does not resize without valid dimensions', () => {
    expect(getCardImageResize(undefined, undefined)).toBeNull();
  });
});
