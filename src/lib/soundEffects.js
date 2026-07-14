import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const pageFlipSoundSource = require('../../assets/audio/freesound_community-page-flip-47177.mp3');

const DEFAULT_EFFECT_VOLUME = 0.01;
const DONE_STAMP_EFFECT_VOLUME = 0.01;

let nativeAudioModePromise = null;
let nativePlayer = null;
let isAudioEnabled = true;

export function setSoundEffectsEnabled(enabled) {
  isAudioEnabled = Boolean(enabled);
}

function configureNativeAudio() {
  if (!nativeAudioModePromise) {
    nativeAudioModePromise = setAudioModeAsync({
      interruptionMode: 'mixWithOthers',
      playsInSilentMode: true,
    }).catch(() => {
      nativeAudioModePromise = null;
    });
  }

  return nativeAudioModePromise;
}

function getNativePlayer() {
  if (nativePlayer) {
    return nativePlayer;
  }

  nativePlayer = createAudioPlayer(pageFlipSoundSource, {
    keepAudioSessionActive: true,
    updateInterval: 1000,
  });
  return nativePlayer;
}

function playPageFlipSound(volume = DEFAULT_EFFECT_VOLUME) {
  if (!isAudioEnabled) {
    return false;
  }

  const player = getNativePlayer();
  if (!player) {
    return false;
  }

  configureNativeAudio()
    .then(() => player.seekTo?.(0))
    .catch(() => {})
    .then(() => {
      player.volume = volume;
      player.play();
    })
    .catch(() => {});

  return true;
}

export function playLeafSwipeSound() {
  playPageFlipSound();
}

export function playModeFlipSound() {
  playPageFlipSound();
}

export function playDoneStampSound() {
  playPageFlipSound(DONE_STAMP_EFFECT_VOLUME);
}

export function playTrashSound() {
  playPageFlipSound();
}
