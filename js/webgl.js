/* eslint-disable no-undef, no-unused-vars */
'use strict';

function createCanvas(id) {
  const canvas = document.getElementById(id);
  const context = canvas.getContext('webgl');
  return { canvas, context };
}

function createShaderProgram(gl, vertexSrc, fragmentSrc, { attribs, uniforms }) {
  const vert = loadShader(gl, gl.VERTEX_SHADER, vertexSrc);
  const frag = loadShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);

  const program = gl.createProgram();
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
  }

  return {
    program,
    attribs: attribs.reduce((obj, a) => (obj[a] = gl.getAttribLocation(program, a), obj), {}),
    uniforms: uniforms.reduce((obj, u) => (obj[u] = gl.getUniformLocation(program, u), obj), {}),
  };
}

function loadShader(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const shaderLog = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('An error occurred compiling the shaders: ' + shaderLog);
  }

  return shader;
}
