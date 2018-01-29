import { createCanvas, createFramebuffer, createShaderProgram } from './webgl';
import { duplicate, groupByN, sums, avg, subs, zip } from './utils';
import { mat4 } from 'gl-matrix/dist/gl-matrix';

import SHADER_VERT from './shader/vert';
import SHADER_FRAG from './shader/frag';
import SHADER_POST_VERT from './shader/postVert';
import SHADER_POST_FRAG from './shader/postFrag';

import reverse_highway from './audio/reverse-highway.mp3';

//
const audio = new Audio();
audio.src = reverse_highway;
audio.loop = true;
audio.autoplay = true;
audio.crossOrigin = 'anonymous';

//
const FREQS = 32, RES = 64, FREQ_START = 0, FREQ_END = -RES * (Math.log(FREQS) / Math.log(2) - 1);
const FREQ_MAX = 255.0;
const FOV = 55 * Math.PI / 180, ZNEAR = 0.1, ZFAR = 100.0;

const SIZE = [16.0, 6.0, 16.0], POINT_SIZE = 8.0;
const DISTANCE0 = 6.0, DISTANCE_MIN = 1.0, DISTANCE_MAX = 16.0;
const DRAG = 0.96;

const POSTPROCESSING = false;

window.addEventListener('load', main, false);

function main() {
  const { canvas, context: gl } = createCanvas('canvas');
  const { analyser } = createAudioContext(audio, FREQS * RES);
  resizeCanvas(gl);

  // initialize WebGL environment
  const Γ = initGL(gl, { analyser, canvas });

  //
  let time0 = 0;
  function loop(time) {
    resizeCanvas(gl);

    const dt = (time - time0) * 0.001;

    update(dt, Γ);

    if (POSTPROCESSING)
      gl.bindFramebuffer(gl.FRAMEBUFFER, Γ.buffers.framebuffer);

    render(gl, dt, Γ);

    if (POSTPROCESSING) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      postprocess(gl, dt, Γ);
    }

    time0 = time;
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);

  // setup events
  canvas.addEventListener('mousedown', onMouseDown, false);
  canvas.addEventListener('touchstart', onMouseDown, false);

  document.addEventListener('mouseup', onMouseUp, false);
  canvas.addEventListener('touchend', onMouseUp, false);

  document.addEventListener('mousemove', onMouseMove, false);
  canvas.addEventListener('touchmove', onMouseMove, false);

  document.addEventListener('mousewheel', onMouseWheel, false);
}


function createAudioContext(audio, fftSize) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext);

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = fftSize;

  const source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);

  return { audioContext, analyser, source };
}

function resizeCanvas(gl) {
  if (gl.canvas.width != gl.canvas.clientWidth || gl.canvas.height != gl.canvas.clientHeight) {
    gl.canvas.width = gl.canvas.clientWidth;
    gl.canvas.height = gl.canvas.clientHeight;
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }
}


function initGL(gl, Γ) {
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.DST_COLOR, gl.ZERO);
  gl.depthMask(false);

  gl.clearColor(1.0, 1.0, 1.0, 1.0);
  gl.clearDepth(1.0);

  const dotsShader =
    createShaderProgram(gl, [ SHADER_VERT, SHADER_FRAG ], {
      attribs: [ 'a_Position', 'a_Force', 'a_Fog' ],
      uniforms: [ 'u_PointSize', 'u_ModelViewMatrix', 'u_ProjectionMatrix' ],
    });
  const postShader =
    createShaderProgram(gl, [ SHADER_POST_VERT, SHADER_POST_FRAG ], {
      attribs: [ 'a_Position' ],
      uniforms: [ 'u_Strength', 'u_Texture' ],
    });

  const { texture: postTexture, framebuffer } = createFramebuffer(gl, [gl.canvas.width, gl.canvas.height]);

  return {
    ...Γ,
    shaders: { dotsShader, postShader },
    buffers: { vertexBuffer: gl.createBuffer(), framebuffer },
    textures: { postTexture },
  };
}


let mouseDown = false, mousePos0 = undefined;
let camera = {
  θ: -Math.PI / 7.0, φ: -Math.PI / 2.0, r: DISTANCE0,
  dθ: 0, dφ: 0, dr: 0,
  d2θ: -0.001, d2φ: 0,
};

const getCoordinatesForEvent = event =>
  event.changedTouches
  ? [event.changedTouches[0].clientX, event.changedTouches[0].clientY]
  : [event.clientX, event.clientY];

function onMouseDown(event) {
  event.preventDefault();
  mouseDown = true;
  mousePos0 = getCoordinatesForEvent(event);
}

function onMouseUp() {
  mouseDown = false;
  audio.play();
}

function onMouseMove(event) {
  event.preventDefault();
  if (!mouseDown)
    return;

  const mousePos = getCoordinatesForEvent(event);
  const delta = subs(mousePos, mousePos0 || mousePos);
  mousePos0 = mousePos;

  camera.d2θ = delta[0] / 200; camera.d2φ = delta[1] / 200;
}

function onMouseWheel(event) {
  event.preventDefault();
  camera.dr += Math.max(-1, Math.min(1, (event.wheelDelta || -event.detail)));
}


let avgFreqs0 = undefined;
const sig = x => x === 0 ? 0 : x > 0 ? 1 : -1;
function update(dt, {analyser}) {
  { // update camera position
    camera.θ += camera.dθ*dt;
    camera.φ += camera.dφ*dt;
    camera.r = Math.max(DISTANCE_MIN, Math.min(DISTANCE_MAX, camera.r + camera.dr*dt));

    camera.dθ += camera.d2θ; camera.dφ += camera.d2φ;
    camera.dθ *= DRAG; camera.dφ *= DRAG; camera.dr *= DRAG;
    camera.d2θ *= DRAG; camera.d2φ *= DRAG;
  }

  { // update frequencies
    let freqs = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqs);
    freqs = freqs.slice(FREQ_START, FREQ_END);

    const avgFreqs = groupByN(freqs, freqs.length / FREQS).map(avg);
    avgFreqs0 = avgFreqs0 || duplicate(avgFreqs);

    const weigh = (w) => Math.pow(w + 1, 2);
    const dfreqs_dt = avgFreqs0.map((freqs0, w) =>
      subs(avgFreqs, freqs0).map(df => df/dt / 300.0 / weigh(w))
    );

    avgFreqs0 = zip(avgFreqs0, dfreqs_dt).map((arrs) => sums.apply(null, arrs));

    // shake and move camera according to lower frequencies
    camera.dφ  += (dfreqs_dt[0][2] + dfreqs_dt[0][((FREQS/3)|0) - 1]) / 10.0 * dt;
    camera.dr  += dfreqs_dt[1][5] * 1.0 * dt;
    camera.d2θ += Math.abs(dfreqs_dt[1][2] / 160.0 * dt) * sig(camera.d2θ);
  }
}


let projectionMatrix = mat4.create(), modelViewMatrix = mat4.create();
function render(gl, dt, {shaders: {dotsShader}, buffers: {vertexBuffer}}) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

  { // build projection and model-view matrices
    mat4.perspective(projectionMatrix,
      FOV,
      gl.canvas.clientWidth / gl.canvas.clientHeight,
      ZNEAR,
      ZFAR
    );

    let { θ, φ, r } = camera;
    mat4.lookAt(modelViewMatrix,
      [Math.sin(φ)*Math.cos(θ)*r, Math.cos(φ)*r + 1, Math.sin(φ)*Math.sin(θ)*r],
      [0, 1, 0],
      [0, 1, 0]
    );

    // setup uniforms
    gl.useProgram(dotsShader.program);
    gl.uniform1f(dotsShader.uniforms.u_PointSize, POINT_SIZE);
    gl.uniformMatrix4fv(dotsShader.uniforms.u_ProjectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(dotsShader.uniforms.u_ModelViewMatrix, false, modelViewMatrix);
  }


  { // setup points
    const points =
      avgFreqs0.slice(0, FREQS/2).flatMap((freqs, z) =>
        freqs.flatMap((freq, x) => {
          const f = freq/FREQ_MAX;
          const w = /*Math.pow(x/FREQS, 4) * 0.5 +*/ Math.pow(z/FREQS * 2, 1.5);

          const xx = (x/FREQS - 0.5) * SIZE[0];
          const yy = f*SIZE[1];
          const zz = z/FREQS * SIZE[2];

          return [...[xx, yy, zz, f, w], ...(z === 0 ? [] : [xx, yy, -zz, f, w])];
        }));


    // draw points
    const stride = 5*4;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

    gl.vertexAttribPointer(dotsShader.attribs.a_Position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(dotsShader.attribs.a_Position);

    gl.vertexAttribPointer(dotsShader.attribs.a_Force, 1, gl.FLOAT, false, stride, 3*4);
    gl.enableVertexAttribArray(dotsShader.attribs.a_Force);

    gl.vertexAttribPointer(dotsShader.attribs.a_Fog, 1, gl.FLOAT, false, stride, 4*4);
    gl.enableVertexAttribArray(dotsShader.attribs.a_Fog);

    gl.drawArrays(gl.POINTS, 0, points.length / stride * 4);
  }
}

function postprocess(gl, dt, {
  shaders: {postShader},
  buffers: {vertexBuffer},
  textures: {postTexture},
}) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);

  gl.useProgram(postShader.program);
  gl.uniform1f(postShader.uniforms.u_Strength, avgFreqs0[1][16] / 255.0);
  gl.uniform1i(postShader.uniforms.u_Texture, 0);
  gl.bindTexture(gl.TEXTURE_2D, postTexture);

  const points = [ -1, -1, 1, -1, 1, 1, -1, 1 ];

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

  gl.vertexAttribPointer(postShader.attribs.a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(postShader.attribs.a_Position);

  gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}
