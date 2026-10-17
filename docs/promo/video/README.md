# The explainer video

`public/loading-lab-explainer.mp4` (and a `.webm` copy) is an 80-second video for the loading lab: an illustrated podcast host
("The Flow Show") explains, in plain words, how factory loading sets cycle time, and what the knee is. It
plays in the game (round 1's brief and the lab's summary) and is served with the site. The host is a
drawing and the voice is synthetic, and the video says so at the end.

The curve and every number in it come from the lab's own model (round 1's line, averaged over 20 days:
10 minutes of work, then 11 at 60% load, 18 at 90%, 25 at 95%, 40 at 100%, 91 at 110%, and about 8% more
shipped from 90% to 100% while cycle time more than doubles). The numbers spoken and captioned are typed
in `script.json`, so if the lab's first line or its spreads change, check them against `curve.ts`'s output
and retype them. Then rebuild.

## Rebuilding it

Work in a scratch folder (call it `$W`); nothing here is kept in the repository except what is in this
folder and the finished video.

1. `npx vite-node docs/promo/video/curve.ts $W/curve.json` writes the curve's numbers.
2. The voice is Kokoro (Apache-2.0), run on the CPU. `pip install kokoro-onnx soundfile`, then download
   `kokoro-v1.0.int8.onnx` and `voices-v1.0.bin` from the kokoro-onnx project's `model-files-v1.0` release
   into a folder of their own (call it `$M`). They are not kept here.
3. `python3 -I docs/promo/video/tts.py $M $W am_michael 1.1` writes `$W/narration.wav` and
   `$W/timeline.json`. It takes a few minutes.
4. `node docs/promo/video/frames.mjs $W` draws 24 frames a second into `$W/frames/` (set `PLAYWRIGHT_DIR`
   and `CHROMIUM_PATH` as for the promo GIF). Add a list of seconds, such as `4,17,40`, to draw only those
   as test frames and look at them first.
5. `ffmpeg -framerate 24 -i $W/frames/f%05d.jpg -i $W/narration.wav -c:v libx264 -pix_fmt yuv420p -crf 20
   -af "afade=t=in:d=0.2,afade=t=out:st=78.5:d=1.5" -c:a aac -b:a 160k -shortest -movflags +faststart
   public/loading-lab-explainer.mp4` (the fade-out time is the video's length minus 1.5 seconds).

6. For browsers without H.264, a second copy: `ffmpeg -framerate 24 -i $W/frames/f%05d.jpg -i $W/narration.wav
   -c:v libvpx-vp9 -crf 36 -b:v 0 -row-mt 1 -pix_fmt yuv420p -af "afade=t=in:d=0.2,afade=t=out:st=78.5:d=1.5"
   -c:a libopus -b:a 96k -shortest public/loading-lab-explainer.webm`. The game offers the MP4 first and
   the WebM to a browser that can't play it.

Change the wording in `script.json` (`say` is spoken, `caption` is shown; each line's `cue` picks what the
right-hand panel draws) and the pictures in `scene.html`.
