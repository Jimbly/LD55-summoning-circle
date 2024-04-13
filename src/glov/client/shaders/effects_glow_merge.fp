#pragma WebGL2

precision lowp float;

varying vec2 interp_texcoord;

uniform sampler2D inputTexture0;
uniform sampler2D inputTexture1;
uniform sampler2D inputTexture2;

uniform vec4 color;
uniform vec4 tex2_transform;

void main()
{
  vec3 tex_lines = texture2D(inputTexture0, interp_texcoord).rgb;
  float v0 = max(tex_lines.r, max(tex_lines.g, tex_lines.b));
  vec3 tex_glow = texture2D(inputTexture1, interp_texcoord).rgb;
  float power_value = texture2D(inputTexture2, interp_texcoord * tex2_transform.xy + tex2_transform.zw).r;
  float glow_value = max(tex_glow.r, max(tex_glow.g, tex_glow.b)) * 3.0;
  tex_lines *= mix(vec3(0.0, 1.0, 1.0), vec3(0.5, 1.0, 0.5), power_value);
  gl_FragColor = vec4((1.0 - v0) * glow_value * color.rgb + tex_lines, 1.0);
  // gl_FragColor.r = power_value;
}
