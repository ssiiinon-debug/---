// Основной материал мира в духе PS1: дрожание вершин, текстуры «ближайший пиксель».
// world_uv = true считает UV от мировых координат, поэтому блоки любого размера
// не растягивают текстуру (удобно для блокаута: меняешь размер — текстура сама тайлится).
shader_type spatial;
render_mode diffuse_lambert, specular_disabled;

#include "res://shaders/psx_common.gdshaderinc"

uniform sampler2D albedo_texture : source_color, filter_nearest, repeat_enable, hint_default_white;
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform bool world_uv = true;
// Сколько метров занимает одна копия текстуры при world_uv.
uniform float texture_meters = 2.0;
uniform vec3 emission_color : source_color = vec3(0.0);
uniform float emission_energy = 0.0;

varying vec3 world_pos;
varying vec3 world_normal;

void vertex() {
	world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	world_normal = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	POSITION = psx_snap(PROJECTION_MATRIX * MODELVIEW_MATRIX * vec4(VERTEX, 1.0));
}

void fragment() {
	vec2 uv = UV;
	if (world_uv) {
		vec3 n = abs(world_normal);
		if (n.y > n.x && n.y > n.z) {
			uv = world_pos.xz;
		} else if (n.x > n.z) {
			uv = vec2(world_pos.z, -world_pos.y);
		} else {
			uv = vec2(world_pos.x, -world_pos.y);
		}
		uv /= texture_meters;
	}
	ALBEDO = texture(albedo_texture, uv).rgb * albedo_color.rgb;
	EMISSION = emission_color * emission_energy;
}
