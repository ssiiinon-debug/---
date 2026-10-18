// Светящиеся точки (глаза Сторожа, огонёк свечи): без освещения и без тумана,
// поэтому их видно в темноте издалека, даже сквозь густой туман.
shader_type spatial;
render_mode unshaded, fog_disabled;

#include "res://shaders/psx_common.gdshaderinc"

uniform vec4 color : source_color = vec4(1.0, 0.92, 0.6, 1.0);
uniform float energy = 1.0;

void vertex() {
	POSITION = psx_snap(PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0));
}

void fragment() {
	ALBEDO = color.rgb * energy;
}
