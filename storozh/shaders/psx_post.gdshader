// Пост-обработка всей 3D-картинки (висит на SubViewportContainer):
// урезание цвета с дизерингом как на PS1, плёночный шум, виньетка и эффекты страха.
shader_type canvas_item;

// Сколько уровней яркости на канал. 32 = 15-битный цвет PS1, меньше — грязнее.
uniform float color_levels = 32.0;
uniform float dither_amount = 1.0;
uniform float grain = 0.035;
uniform float vignette = 0.45;
// 0..1, задаётся игроком: рядом со Сторожем картинка шумит и дёргается.
uniform float fear : hint_range(0.0, 1.0) = 0.0;
// 0..1, белая вспышка камеры.
uniform float flash : hint_range(0.0, 1.0) = 0.0;

float bayer4(vec2 p) {
	int x = int(mod(p.x, 4.0));
	int y = int(mod(p.y, 4.0));
	float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0,
			3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
	return (m[y * 4 + x] + 0.5) / 16.0;
}

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void fragment() {
	vec2 px = floor(UV / TEXTURE_PIXEL_SIZE);
	vec2 uv = UV;

	// Страх: строки картинки съезжают, цвета расслаиваются.
	float f2 = fear * fear;
	float row_shift = (hash(vec2(px.y, floor(TIME * 20.0))) - 0.5) * f2 * 6.0;
	uv.x += row_shift * TEXTURE_PIXEL_SIZE.x;
	float split = f2 * 2.0 * TEXTURE_PIXEL_SIZE.x;
	vec3 col;
	col.r = texture(TEXTURE, uv + vec2(split, 0.0)).r;
	col.g = texture(TEXTURE, uv).g;
	col.b = texture(TEXTURE, uv - vec2(split, 0.0)).b;

	float n = hash(px + fract(TIME * 7.13) * 91.0) - 0.5;
	col += n * (grain + f2 * 0.22);

	vec2 d = UV - 0.5;
	col *= clamp(1.0 - dot(d, d) * (vignette + fear * 1.2), 0.0, 1.0);

	col = mix(col, vec3(1.0), flash);

	col += (bayer4(px) - 0.5) / color_levels * dither_amount;
	col = floor(col * color_levels + 0.5) / color_levels;
	COLOR = vec4(col, 1.0);
}
