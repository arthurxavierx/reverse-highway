// vim: filetype=glsl
import { vertexShader } from '../webgl';

export default vertexShader`

#ifdef GL_ES
precision mediump float;
#endif

attribute vec4 a_Position;
attribute float a_Force;
attribute float a_Fog;
uniform float u_PointSize;
uniform mat4 u_ModelViewMatrix;
uniform mat4 u_ProjectionMatrix;

varying lowp float v_Force;
varying lowp float v_Fog;

void main() {
  gl_Position = u_ProjectionMatrix * u_ModelViewMatrix * a_Position;
  gl_PointSize = u_PointSize / gl_Position.w * 10.0;
  v_Force = a_Force;
  v_Fog = a_Fog;
}

`;
