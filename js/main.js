/* eslint-disable no-undef */
'use strict';

//
const audio = new Audio();
audio.src = 'reverse-highway.mp3';
audio.loop = true;
audio.autoplay = true;
audio.crossOrigin = 'anonymous';

//
const FREQS = 16, RES = 64, FREQ_START = 0, FREQ_END = -RES * 2;
const FOV = 45 * Math.PI / 180, ZNEAR = 0.1, ZFAR = 100.0;

const CUBE_SIZE = 4.0, POINT_SIZE = 6.0;


window.addEventListener('load', main, false);

function main() {
  const { analyser } = createAudioContext(audio, FREQS * RES);
  const { canvas, context: gl } = createCanvas('canvas');
  const shaderProgram = createShaderProgram(gl, $$('#vshader').text, $$('#fshader').text, {
    attribs: [ 'a_Position', 'a_Force' ],
    uniforms: [ 'u_PointSize', 'u_ModelViewMatrix', 'u_ProjectionMatrix' ],
  });

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


let α = Math.PI / 2;
let avgFreqs0 = undefined;

function render(gl, dt, { analyser, shaderProgram, buffers: { vertexBuffer } }) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  { // build projection and model-view matrices
    const projectionMatrix = mat4.create();
    const aspectRatio = gl.canvas.clientWidth / gl.canvas.clientHeight;
    mat4.perspective(projectionMatrix, FOV, aspectRatio, ZNEAR, ZFAR);

    const modelViewMatrix = mat4.create();
    mat4.lookAt(modelViewMatrix,
      [Math.cos(α) * 10, 3.0, Math.sin(α) * 10],
      [0, 0, 0],
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
    avgFreqs0 = avgFreqs0 || avgFreqs;

    const dfreqs_dt = subs(avgFreqs, avgFreqs0).map(df => df/dt / 300.0);

    const points =
      avgFreqs0.flatMap((_, x) =>
        avgFreqs0.flatMap((y, z) =>
          [ (x/FREQS - 0.5) * CUBE_SIZE, y/255.0, (z/FREQS - 0.5) * CUBE_SIZE, y/255.0 ]
        )
      );

    avgFreqs0 = sums(avgFreqs0, dfreqs_dt);

    // draw points
    const stride = 4*4;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);

    gl.vertexAttribPointer(shaderProgram.attribs.a_Position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(shaderProgram.attribs.a_Position);

    gl.vertexAttribPointer(shaderProgram.attribs.a_Force, 1, gl.FLOAT, false, stride, 3*4);
    gl.enableVertexAttribArray(shaderProgram.attribs.a_Force);

    gl.drawArrays(gl.POINTS, 0, points.length / stride * 4);
  }

  // rotate
  α += 0.25 * dt;
}
