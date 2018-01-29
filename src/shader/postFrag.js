// vim: filetype=glsl
import { fragmentShader } from '../webgl';

export default fragmentShader`

#ifdef GL_ES
precision mediump float;
#endif

uniform float u_Strength;
uniform sampler2D u_Texture;

varying vec2 v_UV;

void main() {
  vec4 color = abs(u_Strength - texture2D(u_Texture, v_UV));
  gl_FragColor = vec4(color.rgb, 1);
}

`;
