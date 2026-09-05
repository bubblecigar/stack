import { Image } from 'expo-image';

const cachedImageUrls = new Set();
const pendingImageUrls = new Map();

export function getCardImageSource(imageUri) {
  if (!imageUri) {
    return null;
  }

  return {
    cacheKey: imageUri,
    uri: imageUri,
  };
}

export function prefetchCardImage(imageUri) {
  if (!imageUri || cachedImageUrls.has(imageUri)) {
    return Promise.resolve(true);
  }

  const pendingPrefetch = pendingImageUrls.get(imageUri);
  if (pendingPrefetch) {
    return pendingPrefetch;
  }

  const prefetch = Image.prefetch(imageUri, {
    cachePolicy: 'memory-disk',
  }).then((didCache) => {
    if (didCache) {
      cachedImageUrls.add(imageUri);
    }
    return didCache;
  }).finally(() => {
    pendingImageUrls.delete(imageUri);
  });

  pendingImageUrls.set(imageUri, prefetch);
  return prefetch;
}

export function prefetchCardImages(cards) {
  const imageUrls = [...new Set((Array.isArray(cards) ? cards : [])
    .flatMap((card) => [card?.imageUri, card?.doneStampUri, card?.collectionImageUri])
    .filter(Boolean))];

  return Promise.allSettled(imageUrls.map(prefetchCardImage));
}
