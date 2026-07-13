import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const pageFlipSoundSource = require('../../assets/audio/freesound_community-page-flip-47177.mp3');

let nativeAudioModePromise = null;
let nativePlayer = null;

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

function playPageFlipSound() {
  const player = getNativePlayer();
  if (!player) {
    return false;
  }

  configureNativeAudio()
    .then(() => player.seekTo?.(0))
    .catch(() => {})
    .then(() => {
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
  playPageFlipSound();
}

export function playTrashSound() {
  playPageFlipSound();
}
