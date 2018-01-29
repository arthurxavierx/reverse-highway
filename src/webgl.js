/* eslint-disable no-undef, no-unused-vars */
'use strict';

export function createCanvas(id) {
  const canvas = document.getElementById(id);
  const context = canvas.getContext('webgl');
  return { canvas, context };
}

export function createShaderProgram(gl, shaders, { attribs, uniforms }) {
  const program = gl.createProgram();
  shaders.forEach(shader => gl.attachShader(program, shader(gl)));
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

export const vertexShader = src => gl => loadShader(gl, gl.VERTEX_SHADER, src);
export const fragmentShader = src => gl => loadShader(gl, gl.FRAGMENT_SHADER, src);

export function loadShader(gl, type, src) {
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

export function createFramebuffer(gl, size) {
  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

  const texture = createTexture2D(gl, size);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { texture, framebuffer };
}

export function createTexture2D(gl, [width, height]) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}
