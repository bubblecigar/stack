import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';

const nativeSoundSources = {
  doneStamp: require('../../assets/audio/done_stamp.wav'),
  leafSwipe: require('../../assets/audio/leaf_swipe.wav'),
  modeFlip: require('../../assets/audio/mode_flip.wav'),
  trash: require('../../assets/audio/trash.wav'),
};

let audioContext = null;
let noiseBuffer = null;
let nativeAudioModePromise = null;
const nativePlayers = new Map();

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

function getNativePlayer(soundKey) {
  const existingPlayer = nativePlayers.get(soundKey);
  if (existingPlayer) {
    return existingPlayer;
  }

  const source = nativeSoundSources[soundKey];
  if (!source) {
    return null;
  }

  const player = createAudioPlayer(source, {
    keepAudioSessionActive: true,
    updateInterval: 1000,
  });
  nativePlayers.set(soundKey, player);
  return player;
}

function playNativeSound(soundKey) {
  if (Platform.OS === 'web') {
    return false;
  }

  const player = getNativePlayer(soundKey);
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

function getAudioContext() {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  if (!audioContext) {
    audioContext = new AudioContextClass();
  }

  if (audioContext.state === 'suspended') {
    audioContext.resume?.().catch(() => {});
  }

  return audioContext;
}

function getNoiseBuffer(context) {
  if (noiseBuffer) {
    return noiseBuffer;
  }

  const sampleCount = Math.max(Math.floor(context.sampleRate * 0.28), 1);
  noiseBuffer = context.createBuffer(1, sampleCount, context.sampleRate);
  const samples = noiseBuffer.getChannelData(0);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = (Math.random() * 2) - 1;
  }

  return noiseBuffer;
}

function scheduleGain(gainNode, startTime, points) {
  gainNode.gain.cancelScheduledValues(startTime);
  points.forEach(([offset, value], index) => {
    const time = startTime + offset;
    if (index === 0) {
      gainNode.gain.setValueAtTime(value, time);
      return;
    }

    gainNode.gain.exponentialRampToValueAtTime(Math.max(value, 0.0001), time);
  });
}

function playTone({
  frequency = 440,
  endFrequency = null,
  type = 'sine',
  startOffset = 0,
  duration = 0.12,
  gain = 0.08,
  envelope = null,
}) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const startTime = context.currentTime + startOffset;
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  if (endFrequency !== null) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(endFrequency, 1),
      startTime + duration,
    );
  }

  scheduleGain(gainNode, startTime, envelope || [
    [0, 0.0001],
    [0.01, gain],
    [duration, 0.0001],
  ]);

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.03);
}

function playNoise({
  startOffset = 0,
  duration = 0.12,
  gain = 0.08,
  filterFrequency = 1200,
  filterType = 'highpass',
}) {
  const context = getAudioContext();
  if (!context) {
    return;
  }

  const startTime = context.currentTime + startOffset;
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gainNode = context.createGain();

  source.buffer = getNoiseBuffer(context);
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFrequency, startTime);
  scheduleGain(gainNode, startTime, [
    [0, 0.0001],
    [0.012, gain],
    [duration, 0.0001],
  ]);

  source.connect(filter);
  filter.connect(gainNode);
  gainNode.connect(context.destination);
  source.start(startTime);
  source.stop(startTime + duration + 0.03);
}

export function playLeafSwipeSound() {
  if (playNativeSound('leafSwipe')) {
    return;
  }

  playNoise({
    duration: 0.16,
    gain: 0.045,
    filterFrequency: 900,
  });
  playTone({
    frequency: 520,
    endFrequency: 260,
    type: 'triangle',
    duration: 0.14,
    gain: 0.035,
  });
}

export function playModeFlipSound() {
  if (playNativeSound('modeFlip')) {
    return;
  }

  playTone({
    frequency: 340,
    endFrequency: 620,
    type: 'triangle',
    duration: 0.08,
    gain: 0.055,
  });
  playTone({
    frequency: 620,
    endFrequency: 360,
    type: 'triangle',
    startOffset: 0.08,
    duration: 0.1,
    gain: 0.05,
  });
}

export function playDoneStampSound() {
  if (playNativeSound('doneStamp')) {
    return;
  }

  playTone({
    frequency: 110,
    endFrequency: 78,
    type: 'sine',
    duration: 0.13,
    gain: 0.11,
  });
  playNoise({
    startOffset: 0.01,
    duration: 0.07,
    gain: 0.075,
    filterFrequency: 650,
    filterType: 'lowpass',
  });
}

export function playTrashSound() {
  if (playNativeSound('trash')) {
    return;
  }

  playNoise({
    duration: 0.2,
    gain: 0.08,
    filterFrequency: 520,
    filterType: 'lowpass',
  });
  playTone({
    frequency: 180,
    endFrequency: 64,
    type: 'sawtooth',
    startOffset: 0.03,
    duration: 0.18,
    gain: 0.055,
  });
}
