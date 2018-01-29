// vim: filetype=glsl
import { fragmentShader } from '../webgl';

export default fragmentShader`

#ifdef GL_ES
precision mediump float;
#endif

uniform float u_PointSize;
varying lowp float v_Force;
varying lowp float v_Fog;

const float M_PI = 3.141592654;
const float hmax = 0.35;
const float antialias = 0.75;

const vec3 MAGENTA = vec3(1.0, 0.184, 0.573);
const vec3 CYAN    = vec3(0.0, 0.588, 1.0);
const vec3 YELLOW  = vec3(1.0, 0.831, 0.475);
const vec3 WHITE   = vec3(1.0, 1.0, 1.0);

vec4 blend(vec4 base, vec4 blend) {
  return vec4(base.rgb * blend.rgb * blend.a + base.rgb * (1.0 - blend.a), base.a + blend.a);
}

vec4 fog(vec4 base) {
  return vec4(mix(base.rgb, WHITE, v_Fog), base.a);
}

vec4 circle(vec3 color, float h, float r, float angle, vec2 xy) {
  float dist = distance(xy, vec2(.5 + cos(angle)*h*.5, .5 + sin(angle)*h*.5));
  float alpha = 1.0 - smoothstep(r - antialias / u_PointSize, r, dist);
  return vec4(color, clamp(alpha, 0.0, 1.0));
}

void main() {
  vec2 uv = gl_PointCoord;

  float r = (1.0 - hmax) * 0.5;
  float h = v_Force * hmax;
  float angle = v_Force*M_PI*2.0;

  vec4 magenta = fog(circle(MAGENTA, h, r, -1.0*M_PI/6.0 + angle, uv));
  vec4 cyan    = fog(circle(CYAN,    h, r, -5.0*M_PI/6.0 + angle, uv));
  vec4 yellow  = fog(circle(YELLOW,  h, r, -9.0*M_PI/6.0 + angle, uv));

  vec4 color;
  color = blend(blend(blend(vec4(WHITE, 0.0), magenta), cyan), yellow);
  gl_FragColor = vec4(color.rgb, 1.0);
}

`;
