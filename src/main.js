import { createCanvas, createShaderProgram } from './webgl';
import { duplicate, groupByN, sums, avg, subs, zip } from './utils';
import { mat4 } from 'gl-matrix/dist/gl-matrix';

import SHADER_VERT from './shader/vert';
import SHADER_FRAG from './shader/frag';
// import SHADER_POST from './shaders/post';

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
const FOV = 45 * Math.PI / 180, ZNEAR = 0.1, ZFAR = 100.0;

const SIZE = [16.0, 6.0, 16.0], POINT_SIZE = 8.0;
const ZOOM = 8.0;


window.addEventListener('load', main, false);

function main() {
  const { analyser } = createAudioContext(audio, FREQS * RES);
  const { canvas, context: gl } = createCanvas('canvas');
  const shaderProgram =
    createShaderProgram(gl, [ SHADER_VERT, SHADER_FRAG ], {
      attribs: [ 'a_Position', 'a_Force', 'a_Weight' ],
      uniforms: [ 'u_PointSize', 'u_ModelViewMatrix', 'u_ProjectionMatrix' ],
    });

  canvas.addEventListener('mousedown', onMouseDown, false);
  canvas.addEventListener('touchstart', onMouseDown, false);
  document.addEventListener('mouseup', onMouseUp, false);
  canvas.addEventListener('touchend', onMouseUp, false);
  document.addEventListener('mousemove', onMouseMove, false);
  canvas.addEventListener('touchmove', onMouseMove, false);

  //
  let Γ = { analyser, canvas, shaderProgram };
  Γ = initGL(gl, Γ);

  //
  let time0 = 0;

  function loop(time) {
    resizeCanvas(gl);
    render(gl, (time - time0) / 1000.0, Γ);
    time0 = time;
    window.requestAnimationFrame(loop);
  }
  window.requestAnimationFrame(loop);
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

  return { ...Γ, buffers: { vertexBuffer: gl.createBuffer() } };
}


let mouseDown = false, mousePos0 = undefined;
let camera = { θ: -Math.PI / 1.03, φ: -Math.PI / 2.35, r: ZOOM };

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

  camera.θ += delta[0] / 500; camera.φ += delta[1] / 500;
}


let projectionMatrix = mat4.create(), modelViewMatrix = mat4.create();
let avgFreqs0 = undefined;

function render(gl, dt, { analyser, shaderProgram, buffers: { vertexBuffer } }) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  { // build projection and model-view matrices
    mat4.perspective(projectionMatrix,
      FOV,
      gl.canvas.clientWidth / gl.canvas.clientHeight,
      ZNEAR,
      ZFAR
    );

    let { θ, φ, r } = camera;
    mat4.lookAt(modelViewMatrix,
      [Math.sin(φ)*Math.cos(θ)*r, Math.cos(φ)*r, Math.sin(φ)*Math.sin(θ)*r],
      [0, 1, 0],
      [0, 1, 0]
    );

    // setup uniforms
    gl.useProgram(shaderProgram.program);
    gl.uniform1f(shaderProgram.uniforms.u_PointSize, POINT_SIZE);
    gl.uniformMatrix4fv(shaderProgram.uniforms.u_ProjectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(shaderProgram.uniforms.u_ModelViewMatrix, false, modelViewMatrix);
  }

  { // setup points
    let freqs = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freqs);
    freqs = freqs.slice(FREQ_START, FREQ_END);

    const avgFreqs = groupByN(freqs, freqs.length / FREQS).map(avg);

    avgFreqs0 = avgFreqs0 || duplicate(avgFreqs);

    const weigh = (w) => Math.pow(w + 1, 2);
    const dfreqs_dt = avgFreqs0.map((freqs0, w) =>
      subs(avgFreqs, freqs0).map(df => df/dt / 400.0 / weigh(w))
    );

    const points =
      avgFreqs0.slice(0, FREQS/2).flatMap((freqs, z) =>
        freqs.flatMap((freq, x) => {
          const f = freq/FREQ_MAX;
          const w = z/FREQS * 2;

          const xx = (x/FREQS - 0.5) * SIZE[0];
          const yy = f*SIZE[1];
          const zz = z/FREQS * SIZE[2];

          return [...[xx, yy, zz, f, w], ...(z === 0 ? [] : [xx, yy, -zz, f, w])];
        }));

    avgFreqs0 = zip(avgFreqs0, dfreqs_dt).map((arrs) => sums.apply(null, arrs));

    // draw points
    const stride = 5*4;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

    gl.vertexAttribPointer(shaderProgram.attribs.a_Position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(shaderProgram.attribs.a_Position);

    gl.vertexAttribPointer(shaderProgram.attribs.a_Force, 1, gl.FLOAT, false, stride, 3*4);
    gl.enableVertexAttribArray(shaderProgram.attribs.a_Force);

    gl.vertexAttribPointer(shaderProgram.attribs.a_Weight, 1, gl.FLOAT, false, stride, 4*4);
    gl.enableVertexAttribArray(shaderProgram.attribs.a_Weight);

    gl.drawArrays(gl.POINTS, 0, points.length / stride * 4);
  }
}
