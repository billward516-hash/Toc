# Speaks script.json one sentence at a time with the Kokoro voice, and writes narration.wav and
# timeline.json (when each sentence starts and ends, and how open the mouth is each frame).
#   python3 -I tts.py <model dir> <out dir> [voice] [speed]
import json, sys, wave
import numpy as np
from kokoro_onnx import Kokoro

model_dir, out = sys.argv[1], sys.argv[2]
voice = sys.argv[3] if len(sys.argv) > 3 else 'am_michael'
speed = float(sys.argv[4]) if len(sys.argv) > 4 else 1.1
here = __file__.rsplit('/', 1)[0] if '/' in __file__ else '.'
kokoro = Kokoro(f'{model_dir}/kokoro-v1.0.int8.onnx', f'{model_dir}/voices-v1.0.bin')
script = json.load(open(f'{here}/script.json'))
RATE = 24000
FPS = 24
lead = 0.6
audio = [np.zeros(int(lead * RATE), dtype=np.float32)]
t = lead
timeline = []
for item in script:
    samples, rate = kokoro.create(item['say'], voice=voice, speed=speed, lang='en-us')
    assert rate == RATE, rate
    samples = samples.astype(np.float32)
    nz = np.where(np.abs(samples) > 0.01)[0]
    if len(nz):
        samples = samples[max(0, nz[0] - int(0.05 * RATE)): nz[-1] + int(0.08 * RATE)]
    dur = len(samples) / RATE
    timeline.append({**item, 'start': round(t, 3), 'end': round(t + dur, 3)})
    audio.append(samples)
    audio.append(np.zeros(int(item['pause'] * RATE), dtype=np.float32))
    t += dur + item['pause']
tail = 2.2
audio.append(np.zeros(int(tail * RATE), dtype=np.float32))
total = t + tail
wav = np.concatenate(audio)
wav = wav / (np.max(np.abs(wav)) or 1) * 0.9
with wave.open(f'{out}/narration.wav', 'wb') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(RATE)
    f.writeframes((wav * 32767).astype(np.int16).tobytes())
env = []
for k in range(int(np.ceil(total * FPS))):
    c = int((k / FPS) * RATE)
    w = wav[max(0, c - 600): c + 600]
    env.append(float(np.sqrt(np.mean(w ** 2))) if len(w) else 0.0)
env = np.array(env)
env = np.clip(env / (np.percentile(env, 95) or 1), 0, 1)
smooth = np.convolve(env, [0.25, 0.5, 0.25], mode='same')
json.dump({'fps': FPS, 'total': round(total, 3), 'lines': timeline, 'mouth': [round(float(v), 3) for v in smooth]}, open(f'{out}/timeline.json', 'w'))
print('total seconds', round(total, 1), 'sentences', len(timeline))
