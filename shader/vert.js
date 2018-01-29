// vim: filetype=glsl
const VERTEX_SHADER = vertexShader`

#ifdef GL_ES
precision mediump float;
#endif

attribute vec4 a_Position;
attribute float a_Force;
attribute float a_Weight;
uniform float u_PointSize;
uniform mat4 u_ModelViewMatrix;
uniform mat4 u_ProjectionMatrix;

varying lowp float v_Force;
varying lowp float v_Weight;

void main() {
  gl_Position = u_ProjectionMatrix * u_ModelViewMatrix * a_Position;
  gl_PointSize = u_PointSize / gl_Position.w * 10.0;
  v_Force = a_Force;
  v_Weight = a_Weight;
}

`;
