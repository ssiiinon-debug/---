// Вариант PS1-материала с вырезанием по альфе (трава, ветки). Рисуется с двух сторон.
shader_type spatial;
render_mode diffuse_lambert, specular_disabled, cull_disabled;

#include "res://shaders/psx_common.gdshaderinc"

uniform sampler2D albedo_texture : source_color, filter_nearest, repeat_enable, hint_default_white;
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform float alpha_cut = 0.5;

void vertex() {
	POSITION = psx_snap(PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0));
}

void fragment() {
	vec4 tex = texture(albedo_texture, UV);
	ALBEDO = tex.rgb * albedo_color.rgb;
	ALPHA = tex.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cut;
}
