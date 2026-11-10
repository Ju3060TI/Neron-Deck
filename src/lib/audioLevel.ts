const SPEAKING_THRESHOLD = 0.02;
const POLL_INTERVAL_MS = 120;

export interface AudioLevelMonitor {
  attach(id: string, stream: MediaStream): void;
  detach(id: string): void;
  dispose(): void;
}

interface Tap {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  samples: Float32Array;
}

export function createAudioLevelMonitor(onSpeakingChange: (speakingIds: Set<string>) => void): AudioLevelMonitor {
  const ctx = new AudioContext();
  const silentSink = ctx.createGain();
  silentSink.gain.value = 0;
  silentSink.connect(ctx.destination);

  const taps = new Map<string, Tap>();
  let speaking = new Set<string>();

  const disconnectTap = (id: string) => {
    const tap = taps.get(id);
    if (!tap) return;
    tap.source.disconnect();
    tap.analyser.disconnect();
    taps.delete(id);
  };

  const timer = window.setInterval(() => {
    const next = new Set<string>();
    for (const [id, tap] of taps) {
      tap.analyser.getFloatTimeDomainData(tap.samples);
      let sumSquares = 0;
      for (const sample of tap.samples) sumSquares += sample * sample;
      if (Math.sqrt(sumSquares / tap.samples.length) > SPEAKING_THRESHOLD) next.add(id);
    }
    const changed = next.size !== speaking.size || [...next].some((id) => !speaking.has(id));
    if (changed) {
      speaking = next;
      onSpeakingChange(new Set(next));
    }
  }, POLL_INTERVAL_MS);

  return {
    attach(id, stream) {
      disconnectTap(id);
      if (ctx.state === 'suspended') void ctx.resume();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.connect(silentSink);
      taps.set(id, { source, analyser, samples: new Float32Array(analyser.fftSize) });
    },
    detach(id) {
      disconnectTap(id);
      if (speaking.delete(id)) onSpeakingChange(new Set(speaking));
    },
    dispose() {
      window.clearInterval(timer);
      for (const id of [...taps.keys()]) disconnectTap(id);
      void ctx.close();
    },
  };
}
